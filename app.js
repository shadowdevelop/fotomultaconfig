if (process.platform==='linux'){
    process.chdir('/home/roacho/fotomultasinstall/config')
}
const express = require('express');
const session = require('express-session');
const sqlite3=require('sqlite3').verbose();
const ejs=require('ejs');
const bodyparser = require('body-parser');
const { exec } = require("child_process");

const app= express();
const db=new sqlite3.Database('../fotomultas/config.db');

app.set('view engine','ejs');
app.use(express.static('public'));
app.use(bodyparser.urlencoded({extended:false}));
app.use(session({
    secret:'PA$$w0rd',
    resave:false,
    saveUninitialized:true,
    cookie:{maxAge:60000}
}));



function isAuthenticated(req,res,next){
    if (req.session.user){
        const{role}=req.session.user;
        
        if (req.url==='/config' && role!=='admin'){
            res.status(403).send("Acceso denegado");
        }        

        return next();
        
    }
    res.redirect('/login');
}

// function restartPythonService(){
//     const python_Service="main.py"
// }

app.get('/login',(req,res)=>{
    res.render('login');
});

app.post('/login',(req,res)=>{
    const {username,password}=req.body;

    if (username==='admin' && password==='PA$$w0rd'){
        req.session.user={username,role:'admin'};
        return res.redirect('/config');
    }else if(username==='config' && password==='Adm1n2023$'){
        req.session.user={username,role:'viewer'};
        return res.redirect('/');
    }

    res.status(401).send('Credenciales incorrectas');
});

app.get('/logout',(req,res)=>{
    req.session.destroy();
    res.redirect('/login');
});


app.get('/',isAuthenticated,(req,res)=>{
    const query ='Select * from config where usertipo=2;';
    db.all(query,[],(err,rows)=>{
        if(err){
            throw err;
        }
        res.render('index',{rows});
    });
});

app.get('/config',isAuthenticated,(req,res)=>{
    const query ='Select * from config;';    
    db.all(query,[],(err,rows)=>{
        if(err){
            throw err;
        }
        res.render('config',{rows});
    });
});

app.post('/update',isAuthenticated,(req,res)=>{
    const {id,newValue}=req.body;
    const query ='update config set value = ? where id= ?';
    db.run(query,[newValue,id],function(err){
        if (err){
            return console.error(err.message);
        }
        res.redirect('/');
    });
});

app.get('/resetservice',isAuthenticated,(req,res)=>{

});

const port=process.env.PORT ||  3000;
app.listen(port,()=>{
    console.log('Server is running on port ${port}');
});