const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const LocalStrategy = require('passport-local').Strategy;
const findOrCreate = require("mongoose-findorcreate");
const axios = require("axios");
const date = require(__dirname + "/date.js");
require("dotenv").config();

const app = express();

app.set('view engine', 'ejs');
app.use(express.static("public"));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: "My secret",
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());


const URL = `mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@cluster0.wvkvcg7.mongodb.net/?retryWrites=true&w=majority`;

mongoose.connect(URL, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log("Successfully connected to the database.");
    })
    .catch(err => {
        console.log("Error connecting to the database:", err);
    });

 const itemSchema = {
    name: String
};

const userSchema = new mongoose.Schema({
    email: String,
    name: String,
    password: String,
    googleId: String,
    githubId: String,
    items: [itemSchema]
});

userSchema.plugin(passportLocalMongoose, { usernameField: 'email' });
userSchema.plugin(findOrCreate);

const User = mongoose.model('User', userSchema);

passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(function (id, done) {
    User.findById(id)
        .then(user => done(null, user))
        .catch(err => done(err, null));
});


passport.use(new LocalStrategy(User.authenticate()));

const formatedDate = date.getDate();

app.get("/", (req, res) => {
    res.render("login", {errorMessage: null});
});

app.get("/register", (req, res) => {
    res.render("signup");
});

app.get("/logout", (req, res) => {
    req.logout(() => {
        res.redirect("/");
    });
});

app.get('/todo', (req, res) => {

    if (req.isAuthenticated()) {

        User.findById(req.user.id)
            .then((foundUser) => {
                if (foundUser && foundUser.items.length === 0) {
                    const defaultItems = [
                        { name: "Hey👋 " + req.user.name },
                        { name: "Welcome to your todolist 💝" }
                    ];
                    foundUser.items = defaultItems;
                    foundUser.save()
                        .then(() => { console.log("Default Items Inserted Successfully") })
                        .catch(error => { console.log("Error Inserting Documents: ", error) });
                }
                res.render("list", { listTitle: formatedDate, listArray: foundUser.items });
            })
            .catch(err => {
                console.log("Error Finding Documents: ", err);
                res.redirect("/");
            });
            
    } else {
        // If not authenticated, redirect to the home page
        res.redirect("/");
    }
});


app.post('/todo', (req, res) => {
    const newItem = req.body.newItem;
    if (newItem === null || newItem === undefined || newItem.trim() === "") {
        res.redirect("/todo");
    } else {
        const item = { name: newItem };
        User.findOneAndUpdate(
            { _id: req.user.id },
            { $push: { items: item } },
            { new: true } // returns updated list
        )
            .then(updatedList => {
                if (updatedList) {
                    console.log("New Item Added");
                } else {
                    console.log("Cannot Add Item");
                }
                res.redirect('/todo');
            })
            .catch(err => {
                console.log("Error finding/updating Items:", err);
                res.redirect('/todo');
            });
    }
});

app.post('/delete', async (req, res) => {
    const userId = req.user.id;
    const checkboxID = req.body.checkboxID;

    try {
        const user = await User.findByIdAndUpdate(
            userId,
            { $pull: { items: { _id: checkboxID } } },
            { new: true }
        );
        console.log("Item deleted from the database");
        res.redirect('/todo');
    } catch (err) {
        console.error('Error deleting item:', err);
        res.redirect('/todo');
    }
});

app.get("/login", (req, res)=>{
    res.render("login", {errorMessage: "User Not Found !"});
});

app.post("/login", passport.authenticate('local', {
    successRedirect: '/todo',
    failureRedirect: '/login'
}));
  
app.post("/register", async (req, res) => {

    const { name, email, password } = req.body;

    // Validate email using mailboxlayer API
    try {
        User.register(new User({ email, name }), password, (err, user) => {
            if (err) {
                console.error(err);
                return res.redirect('/register');
            }
    
            // Use req.login to log the user in and then redirect to '/todo'
            req.login(user, function (err) {
                if (err) {
                    console.error(err);
                    return res.redirect('/login');
                }
                return res.redirect('/todo');
            });
        });
    } catch (error) {
        console.error('Email validation error:', error);
        return res.status(500).render("signup", {errorMessage: "Email validation failed. Please try again later"});
    }

    
});

app.use((req, res) => {
    res.status(404).send("Page not found");
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`Server Listening on port ${port}`);
});