// Project  : SOA - Assignment 5
// Prof     : Ed Barsalou
// Students : Amshar Basheer, Grigory Kozyrev, Kyle Stevenson, Ben Lorantfy
// Date     : 2016-11-17

// [ Dependencies ]
var express = require('express');           // Routing
var cors    = require('cors');              // Getting around cross domain restrictions
var fs      = require('fs');                // File system access
var knex    = require("knex");              // SQL query builder
var bcrypt  = require("bcrypt-nodejs");     // Password hashing
    
// [ Config file with db credentials ]
var config  = require("./config.json");     // Config file with database username and password

// [ Start server ]
console.log("Starting server...");

// [ The Knex query builder instance ]
var db = knex(config);

// [ Create the express app ]
var app = express();

// [ Enum for error codes to avoid magic numbers ]
var errors = {
     MALFORMED_JSON:1
    ,ONLY_JSON_OBJECTS:2
    ,MISSING_BODY:3
    ,MISSING_FIELD:4
    ,BAD_DATA_TYPE:5
    ,TOO_LONG:6
    ,NO_USER:7
    ,BAD_PASSWORD:8
    ,PASSWORDS_NOT_MATCHING:9
}

// [ Middleware to get the request body ]
app.use (function(req, res, next) {
    var json='';
    req.setEncoding('utf8');
    req.on('data', function(chunk) { 
       json += chunk;
    });

    req.on('end', function() {    
        if(json == ""){
            next();
        }else{
            try{
                // [ If valid json, set req.body ]
                var data = JSON.parse(json);
                if(isPlainObj(data)){
                    req.body = data;
                    next();
                }else{
                    // [ Tell user json was naughty ]
                    res.end(error("Not a valid JSON object", errors.ONLY_JSON_OBJECTS));
                }
                
            }catch(e){
                // [ Tell user json was naughty ]
                res.end(error("Malformed json", errors.MALFORMED_JSON));
            }            
        }        
    });
});

// [ Utilities ]
function error(message,code){
    if(!code){
        var code = 0;
    }
    
    return JSON.stringify({
        message:message,
        code:code,
        error:true
    });
}

function isPlainObj(o) {
  return typeof o == 'object' && o.constructor == Object;
}

function generateGUID(){
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });   
}

// [ Allows cross origin requests ]
// https://www.html5rocks.com/en/tutorials/cors/
//app.use(cors());

// [ Accepts a request to create a token for a user ]
// - Only grants token if username and password match
app.post("/token",function(req,res){
    // [ Make sure body is present ]
    if(!req.body) return res.end(error("Missing json body", errors.MISSING_BODY));
    
    var data = req.body;
    
    // [ Make sure username is present and valid ]
    if(!data.username)                      return res.end(error("Missing username", errors.MISSING_FIELD));
    if(typeof data.username !== "string")   return res.end(error("Username should be string", errors.BAD_DATA_TYPE));
    if(data.username > 100)                 return res.end(error("Username is too long", errors.TOO_LONG));
    
    // [ Make sure password is present and valid ]
    if(!data.password)                      return res.end(error("Missing password", errors.MISSING_FIELD));
    if(typeof data.password !== "string")   return res.end(error("Password should be string", errors.BAD_DATA_TYPE));
  
    // [ Authentcates user ]
    function authenticate(){
        // [ Tries to find requested user by username ]
        db("User")
            .select("id","username","hash")
            .where("username",data.username)
            .then(function(rows){
                // [ Checks if user was found ]
                if(rows.length == 0) return res.end(error("User doesn't exist", errors.NO_USER));
                var row = rows[0];

                // [ Checks if password matches hash ]
                var authenticated = bcrypt.compareSync(data.password, row.hash);

                // [ Returns error if not authenticated ]
                if(!authenticated) return res.end(error("Password doesn't match", errors.BAD_PASSWORD));

                // [ User is authenticated, create token ]
                var token = {
                     "token": generateGUID() + "-" + generateGUID() + "-" + generateGUID()
                    ,"dateIssued":(new Date()).toISOString()
                    ,"userId":row.id
                    ,"dateRevoked":null
                };

                db("Token").insert(token).then(function(){
                    res.json(token);                
                });
            });        
    }    
    
    // [ Check if user wants to sign up ]
    if(data.signup){
        // [ If user wants to sign up, check additional fields ]
        if(!data.confirmPassword) return res.end(error("Missing confirmation password", errors.MISSING_FIELD));
       
        // [ To avoid typos in passwords, make sure password matches confirmation password ]
        if(data.confirmPassword !== data.password) return res.end(error("Passwords don't match", errors.PASSWORDS_NOT_MATCHING));
        
        // [ Hash the password ]
        var hash = bcrypt.hashSync(data.password);
        
        // [ Insert new user ]
        db("User")
            .insert({
                 username:data.username
                ,hash:hash
                ,dateCreated:(new Date()).toISOString()
            })
            .then(function(){
                // [ Now authenticate after user has been created ]
                authenticate();
            });
        
    }else{
        // [ If user doesn't want to sign up, skip to authentication step ]
        authenticate();
    }
    

});


app.get("/files",function(){
    var username = "ben";
    var root = {
         "name":"root"
        ,"isFolder":true
        ,"isFile":false
        ,"name":""
        ,"path":"/"
        ,children:[]
    };
    
    getFiles(root);
});

function getFiles(folder){
    
}

// [ Listen for requests ]
(function(port){
    app.listen(port, function () {
        console.log('Web server listening on port ' + port + '...');
    });    
})(1337);