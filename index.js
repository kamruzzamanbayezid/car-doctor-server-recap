const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
      origin: ['http://localhost:5173'],
      credentials: true
}))
app.use(express.json());
app.use(cookieParser());

// custom middlewares
const logger = async (req, res, next) => {
      console.log(req.host, req.originalUrl);
      next();
}

// verify token
const verifyToken = async (req, res, next) => {

      const token = req.cookies?.token;

      if (!token) {
            return res.status(401).send({ message: 'Not Authorized' })
      }
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
                  return res.status(401).send({ message: 'Not Authorized' })
            }
            console.log('decoded email', decoded?.email);
            req.user = decoded
            next()
      })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.d8abmis.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
      serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
      }
});

async function run() {
      try {
            // Connect the client to the server	(optional starting in v4.7)
            await client.connect();

            const servicesCollection = client.db("carDoctor").collection("services");
            const bookingsCollection = client.db("carDoctor").collection("bookings");

            // auth related api's
            app.post('/jwt', async (req, res) => {
                  const user = req.body;
                  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
                  res
                        .cookie('token', token, {
                              httpOnly: true,
                              sameSite: 'lax',
                              secure: false
                        })
                        .send({ message: true })
            })

            // services related api's
            app.get('/services', logger, async (req, res) => {
                  // console.log('inside services', req.cookies.token);
                  const result = await servicesCollection.find().toArray()
                  res.send(result);
            })

            app.get('/services/:id', async (req, res) => {
                  const id = req.params.id
                  const query = { _id: id }
                  const options = {
                        projection: { title: 1, price: 1, service_id: 1, img: 1 }
                  }
                  const result = await servicesCollection.findOne(query, options)
                  res.send(result)
            })

            // bookings related api's
            app.post('/bookings', async (req, res) => {
                  const service = req.body;
                  const result = await bookingsCollection.insertOne(service);
                  res.send(result);
            })

            app.get('/bookings', verifyToken, async (req, res) => {
                  let query = {}
                  
                  if (req.user?.email !== req.query?.email) {
                        return res.status(401).send({ message: 'Not Authorized' })
                  }
                  if (req.query?.email) {
                        query = { email: req.query?.email }
                  }
                  const result = await bookingsCollection.find(query).toArray()
                  res.send(result);
            })

            app.patch('/bookings/:id', async (req, res) => {
                  const booking = req.body;
                  const query = { _id: new ObjectId(req.params.id) }
                  const options = {
                        $set: {
                              status: booking?.status
                        }
                  }
                  const result = await bookingsCollection.updateOne(query, options);
                  res.send(result)
            })

            app.delete('/bookings/:id', async (req, res) => {
                  const query = { _id: new ObjectId(req.params.id) }
                  const result = await bookingsCollection.deleteOne(query);
                  res.send(result)
            })

            // Send a ping to confirm a successful connection
            await client.db("admin").command({ ping: 1 });
            console.log("Pinged your deployment. You successfully connected to MongoDB!");
      } finally {
            // Ensures that the client will close when you finish/error
            // await client.close();
      }
}
run().catch(console.dir);


app.get('/', (req, res) => {
      res.send('Car Doctor Website!')
})

app.listen(port, () => {
      console.log(`Car Doctor app is listening on port ${port}`)
})