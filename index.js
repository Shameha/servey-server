const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIP_SECREAT_KEY)
const port = process.env.PORT || 5000;


//middleware
app.use(
  cors()
);
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.t86vw4m.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
console.log(uri);
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
    // await client.connect();
    const surveyCollection = client.db("surveyDb").collection("servey");
    const reviewCollection = client.db("surveyDb").collection("reviews");
    const usersCollection = client.db("surveyDb").collection("users");
    const paymentCollection = client.db("surveyDb").collection("payments");
 
    // const Collection = client.db("surveyDb").collection("reviews");

//jwt related api
app.post('/jwt', async(req,res)=>{
  const user = req.body;
  const token = jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{
    expiresIn:'2h'
  })
  res.send({token})
})


//verify token
// const verifyToken = (req,res,next)=>{
// console.log("inside verify token",req.headers.authorization);
// if(req.headers.authorization){
//   return res.status(401).send({message:'forbidden'})
// }

// const token= req.headers.authorization.split(' ')[1];
// jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
//   if(err){
//     return res.status(401).send({message:'forbidden access'})
//   }
//   req.decoded= decoded;
//   next();
// })
// }

const verifyToken =(req,res,next)=>{
  console.log("inside verify",req.headers.authorization);
  if(!req.headers.authorization){
    return res.status(401).send({massage:'unauthorized access'})
  }
  const token = req.headers.authorization.split(' ')[1];
  jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
    if(err){
      return res.status(401).send({message:'unauthorized  access'})
    }
    req.decoded = decoded;
    next();
  })
  // next();
 }

 const verifyAdmin = async (req,res,next) =>{
  const email = req.decoded.email;
  const query = {email: email};
  const user = await usersCollection.findOne(query);
  const isAdmin = user?.role === 'admin';
  if(!isAdmin){
    return res.status(403).send({message:'forbidden access'});

  }
  next();
 }

app.get('/users',verifyToken,verifyAdmin,async(req,res)=>{
  console.log(req.headers);
  const result = await usersCollection.find().toArray();
  res.send(result);
});

app.get('/users/admin/:email',verifyToken,async(req,res)=>{

  const email = req.params.email;
  if(email !== req.decoded.email){
    return res.status(403).send({message:"forbidden access"})
  }
  const query={email:email};
  console.log(query);
  const user = await usersCollection.findOne(query);
  let admin = false;
  if(user){
    admin = user?.role === 'admin';
    
  }
  res.send({ admin })

})


// app.get('/users/survey/:email',async(req,res)=>{

//   const email = req.params.email;
//   if(email !== req.decoded.email){
//     return res.status(403).send({message:"forbidden access"})
//   }
//   const query={email:email};
//   const user = await usersCollection.findOne(query);
//   let survey = false;
//   if(user){
//     survey = user?.role === 'survey';
    
//   }
//   res.send({ survey })

// })

    app.post('/users',async(req,res)=>{
  const user = req.body;
  //insert email doesnot exist
  const query ={email: user.email}
  const existingUser = await usersCollection.findOne(query);
  if(existingUser){
    return res.send({message : 'user already exist',inseredId:null})
  }
  const result = await usersCollection.insertOne(user);
  res.send(result);
})

app.patch('/users/admin/:id',async(req,res)=>{
  const id = req.params.id;
  const filter ={_id: new ObjectId(id)};
  const updateDoc ={
    $set:{
      role:'admin',
    }
  }
  const result = await usersCollection.updateOne(filter,updateDoc)
  res.send(result);
})


app.patch('/users/survey/:id',async(req,res)=>{
  const id = req.params.id;
  const filter ={_id: new ObjectId(id)};
  const updateDoc ={
    $set:{
      role:'survey'
    }
  }
  const result = await usersCollection.updateOne(filter,updateDoc)
  res.send(result);
})



app.delete('/users/:id',async(req,res)=>{
  const id = req.params.id;
  const query = {_id:new ObjectId(id)}
  const result = await usersCollection.deleteOne(query);
  res.send(result);
})

//survay related api
    app.get("/servey",async(req,res)=>{
        const result= await surveyCollection.find().toArray();
        res.send(result)
    })

app.get('/servey/:id',async(req,res)=>{
  const id = req.params.id;
  const query ={_id: new ObjectId(id)};
  const options = {
    projection: { title: 1, description: 1 },
  };
  const result = await surveyCollection.findOne(query,options);
  res.send(result);
})


app.get("/reviews",async(req,res)=>{
  const result= await reviewCollection.find().toArray();
  res.send(result)
})

app.post('/create-payment-intent',async(req,res)=>{
const {price} = req.body;
const amount = parseInt(price * 100);

const paymentIntent = await stripe.paymentIntent.create({
  amount: amount,
  currency:'usd',
  payment_method_type :[card]
});
res.send({
  clientSecret : paymentIntent.client_secret
})

})

app.post('/payments',async(req,res)=>{
  const payment = req.body;
  const paymentResult = await paymentCollection.insertOne(payment);
  console.log('payment result',payment);
  res.send(paymentResult)
})
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/',(req,res)=>{
    res.send("surver is sitting");
})

app.listen(port,() =>{
    console.log(`server is sitting ${port}`);
});
