const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const {MongoClient, ServerApiVersion, ObjectId} = require('mongodb');
require('dotenv').config();

// Stripe Secret Key
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

// Middleware
app.use(cors());
app.use(express.json());
// Port
const port = process.env.PORT || 5001

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cyp27.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

//==============================//
//			Tokeyn Verify		//
//==============================//
function verifyJWT(req, res, next) {
	const authHeader = req.headers.authorization;
	if (!authHeader) {
		return res.status(401).send({
			message: 'UnAuthorized access'
		});
	}
	const token = authHeader.split(' ')[1];
	jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
		if (err) {
			return res.status(403).send({
				message: 'Forbidden access'
			})
		}
		req.decoded = decoded;
		next();
	});
}

// ===============All API==============
async function run() {
	try {
		client.connect();
		console.log('DB Connected');
		const userCollection = client.db("manufacturer").collection("users");
		const productCollection = client.db("manufacturer").collection("products");
		const bannerCollection = client.db("manufacturer").collection("banners");
		const orderCollection = client.db("manufacturer").collection("orders");
		const blogCollection = client.db("manufacturer").collection("blogs");
		const reviewCollection = client.db("manufacturer").collection("reviews");
		const paymentCollection = client.db("manufacturer").collection("payments");
		const portFolioCollection = client.db("manufacturer").collection("portfolios");
		const adminInfoCollection = client.db("manufacturer").collection("adminsinfos");

		//==============================//
		//			Admin Verify		//
		//==============================//
		const verifyAdmin = async (req, res, next) => {
		const userEmail = req.decoded.email;
		const userAccount = await userCollection.findOne({ email: userEmail });
		if (userAccount.role === 'admin') {
			next();
		}
		else {
			res.status(403).send({ message: 'forbidden' });
		}
		}
		
		//==============================//
		//			Stripe Controller	//
		//==============================//
		 app.post('/payment-intent', verifyJWT, async(req, res) =>{
			const {total} = req.body;
			// console.log(typeof total)
			const amount = parseInt(total)*100;
			const paymentIntent = await stripe.paymentIntents.create({
				// description: 'Software development services',
				// shipping: {
				// 	name: 'Jenny Rosen',
				// 	address: {
				// 	line1: '510 Townsend St',
				// 	postal_code: '98140',
				// 	city: 'San Francisco',
				// 	state: 'CA',
				// 	country: 'US',
				// 	},
				// },
				amount : amount,
				currency: 'usd',
				payment_method_types:['card']
		});
			res.send({clientSecret: paymentIntent.client_secret})
		});

		//==============================//
		//			User Controller		//
		//==============================//

		// ===Create Token by Email and Save Data into Server===
        app.put('/signin/:email', async (req, res) => {
			const email = req.params.email;
			const user = req.body;
			const filter = { email: email };
			const options = { upsert: true };
			const updateUser = {
				$set: {...user},
			};
			const result = await userCollection.updateOne(filter, updateUser, options);
			const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, /*{ expiresIn: '1h' }*/)
			res.send({ result, token });

        })

		// ====Update User Profile ======
		 app.put('/user/:email', async (req, res)=>{
			// const id = req.params.id;
			const email = req.params.email;
			const user = req.body;
			// const filter = {_id: ObjectId(id)};
			const filter = { email: email };
			const options ={ upsert: true };
			const updateUser = {
				$set:{
					name: user.name,
					phone: user.phone,
					about: user.about,
					education: user.education,
					profession: user.profession,
					address: user.address,
					linkedin: user.linkedin,
					img: user.img
				}
			};
			const result = await userCollection.updateOne(filter, updateUser, options);
			res.send(result);
		});

		// Get All Users
		app.get('/users', async (req, res) => {
			const query = {};
		 	const cursor = userCollection.find(query);
		 	const users = await cursor.toArray();
			res.send(users);
		});

		// Get User by email
		app.get("/myprofile", verifyJWT, async (req, res) => {
            const tokenInfo = req.headers.authorization;
            const [email, accessToken] = tokenInfo.split(" ")
			const decodedEmail = req.decoded.email;
            if (email === decodedEmail) {
                const myprofile = await userCollection.find({email: email}).toArray();
                res.send(myprofile);
            }
            else {
                return res.status(403).send({ success: 'Forbidden Access' })
            }
		})

		// Make admin by Email
        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
			const email = req.params.email;
			const filter = { email: email };
			const updateAdmin = {
				$set: { role: 'admin' },
			};
			const result = await userCollection.updateOne(filter, updateAdmin);
			res.send(result);
        })

		// Get Admin Access
		app.get('/admin/:email', async (req, res) => {
			const email = req.params.email;
			const user = await userCollection.findOne({ email: email });
			const isAdmin = user?.role === 'admin';
			res.send({ admin: isAdmin })
		})

		// Delete User by Email
		app.delete('/delete-admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
			const email = req.params.email;
			const filter = { email: email };
			const result = await userCollection.deleteOne(filter);
			res.send(result);
		})

		//==============================//
		//		Product Controller		//
		//==============================//

		// ====Add Product======
		 app.post('/product', verifyJWT, verifyAdmin, async (req, res) => {
		 	const product = req.body;
		 	const result = await productCollection.insertOne(product);
		 	res.send(result);
		 });

		 // ====Get Products======
		 app.get('/products', async (req, res) => {
		 	const query = {};
		 	const cursor = productCollection.find(query);
		 	const products = await cursor.toArray();
		 	res.send(products);
		 });

		// ====Get Single Product======
		app.get('/product/:id', async(req, res) =>{
			const id = req.params.id;
			const query = { _id: ObjectId(id) };
			const product = await productCollection.findOne(query);
			res.send(product);
		})

		// ====Update Product======
		app.put('/product/:id', async (req, res)=>{
			const id = req.params.id;
			const product = req.body;
			const filter = {_id: ObjectId(id)};
			const options ={ upsert: true };
			const updateProduct = {
				$set:{
					title: product.title,
					description: product.description,
					quantity: product.quantity,
					minorder: product.minorder,
					price: product.price,
					review: product.review,
					img: product.img
				}
			};
			const result = await productCollection.updateOne(filter, updateProduct, options);
			res.send(result);
		});

		// ====Delete Product======
		app.delete('/product/:id', async (req, res) => {
			const id = req.params.id;
		    const productId = { _id: ObjectId(id) };
		    const result = await productCollection.deleteOne(productId);
		    res.send(result);
		});

		//==============================//
		//		Order Controller		//
		//==============================//

		//=========Add Order======
		 app.post("/order", async (req, res) => {
            const orderProduct = req.body;
            const result = await orderCollection.insertOne(orderProduct);
            res.send(result)
        })

		//=========Get All Order======
		 app.get("/orders", async (req, res) => {
            const query = {};
			const cursor =  orderCollection.find(query);
			const orders = await cursor.toArray();
            res.send(orders)
        })

		//=========Get Order by Email======
		app.get("/myorders", verifyJWT, async (req, res) => {
            const tokenInfo = req.headers.authorization;
            const [email, accessToken] = tokenInfo.split(" ")
			const decodedEmail = req.decoded.email;
            if (email === decodedEmail) {
                const myorders = await orderCollection.find({email: email}).toArray();
                res.send(myorders);
            }
            else {
                return res.status(403).send({ success: 'Forbidden Access' })
            }
		})

		 // ====Get Signle Order=====
		app.get('/order/:id', async(req, res) =>{
			const id = req.params.id;
			const query = { _id: ObjectId(id) };
			const order = await orderCollection.findOne(query);
			res.send(order);
		})

		// =======Update Stripe payment order======
		app.patch('/order/:id', async(req, res) =>{
			const id  = req.params.id;
			const payment = req.body;
			const filter = {_id: ObjectId(id)};
			const updatedDoc = {
				$set: {
				paid: true,
				transactionId: payment.transactionId
				}
			}

			const result = await paymentCollection.insertOne(payment);
			const updatedOrder = await orderCollection.updateOne(filter, updatedDoc);
			res.send(updatedOrder);
		})

		 // ====Delete Order======
		app.delete('/order/:id', async (req, res) => {
			const id = req.params.id;
		    const ordertId = { _id: ObjectId(id) };
		    const result = await orderCollection.deleteOne(ordertId);
		    res.send(result);
		});

		//==============================//
		//		Review Controller		//
		//==============================//
		 app.post('/review', verifyJWT, async (req, res) => {
		 	const review = req.body;
		 	const result = await reviewCollection.insertOne(review);
		 	res.send(result);
		 });

		// ====Get all Reviews======
		app.get("/reviews", async(req, res)=>{
			const query = {};
		 	const cursor = reviewCollection.find(query);
		 	const reviews = await cursor.toArray();
            res.send(reviews)
		})

		// ====Delete Review======
		app.delete('/review/:id', async (req, res) => {
			const id = req.params.id;
		    const reviewtId = { _id: ObjectId(id) };
		    const result = await reviewCollection.deleteOne(reviewtId);
		    res.send(result);
		});

		//==============================//
		//		Blog Controller			//
		//==============================//

		// ====Add Blog======
		 app.post('/blog', verifyJWT, verifyAdmin, async (req, res) => {
		 	const blog = req.body;
		 	const result = await blogCollection.insertOne(blog);
		 	res.send(result);
		 });

		 // ====Get Blogs======
		 app.get('/blogs', async (req, res) => {
		 	const query = {};
		 	const cursor = blogCollection.find(query);
		 	const blogs = await cursor.toArray();
		 	res.send(blogs);
		 });
		
		// ====Get Single Blog======
		app.get('/blog/:id', async(req, res) =>{
			const id = req.params.id;
			const query = {_id: ObjectId(id)};
			const blog = await blogCollection.findOne(query);
			res.send(blog);
		})

		// ====Update Blog======
		app.put('/blog/:id', async (req, res)=>{
			const id = req.params.id;
			const blog = req.body;
			const filter = {_id: ObjectId(id)};
			const options ={ upsert: true };
			const updateBlog = {
				$set:{
					title: blog.title,
					description: blog.description,
					img: blog.img
				}
			};
			const result = await blogCollection.updateOne(filter, updateBlog, options);
			res.send(result);
		});

		// ====Delete Blog======
		app.delete('/blog/:id', async(req, res) => {
			const id = req.params.id;
		    const blogId = { _id: ObjectId(id) };
		    const result = await blogCollection.deleteOne(blogId);
		    res.send(result);
		});

		//==============================//
		//		Portfolio Controller	//
		//==============================//

		// ====Add Portfolio======
		 app.post('/portfolio', verifyJWT, verifyAdmin, async (req, res) => {
		 	const portfolio = req.body;
		 	const result = await portFolioCollection.insertOne(portfolio);
		 	res.send(result);
		 });

		 // ====Get All Portfolio======
		 app.get('/portfolios', async (req, res) => {
		 	const query = {};
		 	const cursor = portFolioCollection.find(query);
		 	const portfolios = await cursor.toArray();
		 	res.send(portfolios);
		 });
		
		// ====Get Single Portfolio======
		app.get('/portfolio/:id', async(req, res) =>{
			const id = req.params.id;
			const query = {_id: ObjectId(id)};
			const blog = await portFolioCollection.findOne(query);
			res.send(blog);
		})

		// ====Update Portfolio======
		app.put('/portfolio/:id', async (req, res)=>{
			const id = req.params.id;
			const portfolio = req.body;
			const filter = {_id: ObjectId(id)};
			const options ={ upsert: true };
			const updatePortfolio = {
				$set:{
					title: portfolio.title,
					description: portfolio.description,
					img: portfolio.img,
					link: portfolio.link
				}
			};
			const result = await portFolioCollection.updateOne(filter, updatePortfolio, options);
			res.send(result);
		});

		// ====Delete Portfolio======
		app.delete('/portfolio/:id', async(req, res) => {
			const id = req.params.id;
		    const portfolioId = { _id: ObjectId(id) };
		    const result = await portFolioCollection.deleteOne(portfolioId);
		    res.send(result);
		});

		//==============================//
		//	Admin Profile Controller	//
		//==============================//

		// ====Add Admin Profile info======
		 app.post('/adminprofile', verifyJWT, verifyAdmin, async (req, res) => {
		 	const adminProfile = req.body;
		 	const result = await adminInfoCollection.insertOne(adminProfile);
		 	res.send(result);
		 });

		 // ====Get All Profile Data======
		 app.get('/adminprofiles', async (req, res) => {
		 	const query = {};
		 	const cursor = adminInfoCollection.find(query);
		 	const adminProfiles = await cursor.toArray();
		 	res.send(adminProfiles);
		 });

		// ====Update Profile======
		app.put('/adminprofile/:id', async (req, res)=>{
			const id = req.params.id;
			const adminProfile = req.body;
			const filter = {_id: ObjectId(id)};
			const options ={ upsert: true };
			const updateAdminProfile = {
				$set:{
					name: adminProfile.name,
					description: adminProfile.description,
					facebook:adminProfile.facebook,
                    fiverr:adminProfile.fiverr,
                    upwork: adminProfile.upwork,
                    github:adminProfile.github,
                    linkedin: adminProfile.linkedin,
					img: adminProfile.img
				}
			};
			const result = await adminInfoCollection.updateOne(filter, updateAdminProfile, options);
			res.send(result);
		});

		// ====Delete Profile======
		app.delete('/adminprofile/:id', async(req, res) => {
			const id = req.params.id;
		    const adminProfileId = { _id: ObjectId(id) };
		    const result = await adminInfoCollection.deleteOne(adminProfileId);
		    res.send(result);
		});
		//==============================//
		//		Banner Controller		//
		//==============================//

		// ====Add Banner======
		 app.post('/banner', verifyJWT, verifyAdmin, async (req, res) => {
		 	const adminProfile = req.body;
		 	const result = await bannerCollection.insertOne(adminProfile);
		 	res.send(result);
		 });

		 // ====Get All Banner======
		 app.get('/banners', async (req, res) => {
		 	const query = {};
		 	const cursor = bannerCollection.find(query);
		 	const banners = await cursor.toArray();
		 	res.send(banners);
		 });

		// ====Update Profile======
		app.put('/banner/:id', async (req, res)=>{
			const id = req.params.id;
			const banner = req.body;
			const filter = {_id: ObjectId(id)};
			const options ={ upsert: true };
			const updateBanner = {
				$set:{
					title: banner.title,
					description: banner.description,
					img: banner.img
				}
			};
			const result = await bannerCollection.updateOne(filter, updateBanner, options);
			res.send(result);
		});

		// ====Delete Banner======
		app.delete('/banner/:id', async(req, res) => {
			const id = req.params.id;
		    const bannerId = { _id: ObjectId(id) };
		    const result = await bannerCollection.deleteOne(bannerId);
		    res.send(result);
		});

	} catch (error) {
		res.send(error);
	} finally {

	}
}
run().catch(console.dir)


app.get('/', (req, res) => {
	res.send('Infiniy Manufacturer Server is Running')
})

app.listen(port, () => {
	console.log(`Infiniy Manufacturer listening on port ${port}`)
})