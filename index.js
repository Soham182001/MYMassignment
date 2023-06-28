const express = require('express');
const app = express();
const bodyParser = require('body-parser')
const axios = require("axios");
const mongoose = require('mongoose');
const User = require('./models/user');
const session = require('express-session');
const passport = require('passport');
const googleStrategy = require('passport-google-oauth20')
require('dotenv').config()
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY;
const uri = process.env.MONGO_KEY;
app.use(bodyParser.urlencoded({
    extended:true
}));



// mongodb connection
mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,})
    .then(() => {
        console.log('Database Connected!');
    })
    .catch(() => {
        console.log('Database Connection Failed!');
    })



// view engine
app.set('view engine', 'ejs');



// auth
passport.use(new googleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3001/auth/google/callback"
}, (request, accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}))
passport.serializeUser(function(user, done){
    done(null, user);
})
passport.deserializeUser(function(user, done){
    done(null, user);
})



// creating session
app.use(session({
    secret: 'something secret',
    resave :false,
    saveUninitialized: true,
}));
app.use(passport.initialize());
app.use(passport.session());



// geenrating api key
let ts = Date.now();
let dt = new Date(ts);
const full_date = (dt.getFullYear()-1) + "-" + (dt.getMonth() + 1) + "-" + dt.getDate();
const URL = "https://api.nasa.gov/planetary/apod?api_key="+API_KEY+"&date="+full_date+"&concept_tags=True";



// getting photo
const getData = async (URL) => {
    try {
      const response = await axios.get(URL);
      return response.data;
    } catch (error) {
      console.log("Unable to fetch data from API at this moment!");
    }
  };



app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
})
// main page route
app.get('/', async (req, res) => {
    res.render('login', {success: '', error: ''});
})



// google auth
app.get('/auth/google', 
    passport.authenticate('google', {scope: ['email', 'profile']})
)



// login via google
function isLoggedin(req, res, next){
    req.user ? next() : res.redirect('/');
}
app.get('/login1', isLoggedin, (req, res) => {
    getData(URL).then((info) => {
        res.render('index', {data: info, email: req.session.passport.user.displayName});
    }).catch(() => {
        res.render('login', {success: '', error: 'Something Went Wrong!'});
    });
})



// google callback
app.get('/auth/google/callback', 
    passport.authenticate('google', {
        successRedirect: '/login1',
        failureRedirect: '/failure'
    })
)



// fail login
app.get('/failure', (req, res) => {
    res.render('login', {success: '', error: 'Unable To Login! Please Try Again!'});
})



app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
})
// signup page route
app.get('/signup', (req, res) => {
    res.render('signup');
})



app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
})
//login
app.get('/login', (req, res) => {
    if(req.session.user_id){
        getData(URL).then((info) => {
            res.render('index', {data: info, email: req.session.email});
        }).catch(() => {
            console.log("Unable to fetch data from API at this moment!");
        });
    }else{
        res.render('login', {success: '', error: 'Something Went Wrong!'});
    }
})



// photo page route
function authenticateUser(allUsers, extUser){
    for (let i = 0; i < allUsers.length; i++) {
        if(allUsers[i].email === extUser.email && allUsers[i].password === extUser.password)return allUsers[i];
    }   
    return null;
}
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
})
app.post('/login', async (req, res) => {
    const existingUser = req.body;
    const allUsers = await User.find({});
    const validUser = authenticateUser(allUsers, existingUser);
    if(validUser){
        req.session.user_id = validUser._id;
        req.session.email = validUser.email;
        res.redirect('/login');
    }else{
        // invalid credentials
        res.render("login", {success: '', error: 'Invalid Credentials!'});
    }
})



// post request after new user signup route
function validateUser(allUsers, newUser){
    for(let i=0; i<allUsers.length; i++){
        if(allUsers[i].email == newUser.email){
            return false;
        }
    }
    return true;
}
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
})
app.post('/signup', async (req, res) => {
    const newUser = new User(req.body);
    const allUsers = await User.find({});
    if(validateUser(allUsers, newUser)){
        await newUser.save();
        // flash account created
        res.render('login', {success: 'Account Successfully Created!', error: ''});
    }else{
        // flash username already existed
        res.render('login', {success: '', error: 'Email Already Existed!'});
    }
})



app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
})
// post request to logout
app.post('/logout', (req, res) => {
    req.session.user_id = null;
    req.session.destroy();
    res.render('login', {success: 'Successfully Logged Out!', error: ''});
})



// starting server
app.listen(PORT, function(error){
    if(error){
        console.log("Something went wrong: "+ error);
    }else{
        console.log("Server is listening on port: "+PORT);
    }
});