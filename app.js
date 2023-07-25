if (process.platform==='linux'){
    process.chdir('/home/roacho/fotomultasinstall/config')
}
const express = require('express');
const session = require('express-session');
const fileupload=require('express-fileupload');
const AdmZip=require('adm-zip');
const fs=require('fs');
const sqlite3=require('sqlite3').verbose();
const ejs=require('ejs');
const bodyparser = require('body-parser');
const { exec } = require("child_process");
const { isatty } = require('tty');
const path = require('path');
const archiver = require('archiver');

const app= express();
const db=new sqlite3.Database('../fotomultas/config.db');
const dbreporte=new sqlite3.Database('../fotomultas/reporte.db');
const mime = require('mime');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const child_process = require('child_process');


app.set('view engine','ejs');
app.use(express.static('public'));
app.use(bodyparser.urlencoded({extended:false}));
app.use(session({
    secret:'PA$$w0rd',
    resave:false,
    saveUninitialized:true,
    cookie:{maxAge:60000}
}));
app.use(fileupload());





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
    res.render('login',{error:'Credenciales incorrectas'});
    //res.status(401).send('Credenciales incorrectas');
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

app.post('/updateconfig',isAuthenticated,(req,res)=>{
    const {id,newValue}=req.body;
    const query ='update config set value = ? where id= ?';
    db.run(query,[newValue,id],function(err){
        if (err){
            return console.error(err.message);
        }
        res.redirect('/config');
    });
});

app.get('/uploadlist',isAuthenticated,(req,res)=>{
    const rutaarchivos='./versiones';
    fs.readdir(rutaarchivos,(err,files)=>{
        if (err){
            return res.status(500).send(err);
        }

        const archivosZip = files.filter(file => file.endsWith('.zip'));  

        res.render('uploadlist', { archivosZip }); 
    });
});

app.post('/upload',(req,res)=>{
    if (!req.files || Object.keys(req.files).length===0){
        return res.status(400).send('No se ha seleccionado ningún archivo.');
    }
    const rutaarchivos='./versiones';
    const archivo=req.files.archivo;
    const nombreArchivo = archivo.name;
    const rutaDestino = './versiones/' + nombreArchivo;


    if (fs.existsSync(rutaDestino)){
        fs.unlinkSync(rutaDestino);
    }

    if (fs.existsSync('./install')){
        fs.rmSync('./install',{recursive:true});
    }

    fs.mkdirSync('./install');


    archivo.mv(rutaDestino,(err)=>{
        if(err){
            return res.status(500).send(err);
        }

        const zip=new AdmZip(rutaDestino);

        zip.extractAllTo('./install',true);


        const installScriptPath = './install/install.sh';
        if (fs.existsSync(installScriptPath)) {
            const child = child_process.spawn('sh', [installScriptPath], { detached: true });
            child.unref();
        }
        
        fs.readdir(rutaarchivos,(err,files)=>{
            if (err){
                return res.status(500).send(err);
            }
    
            const archivosZip = files.filter(file => file.endsWith('.zip'));  
    
            res.render('uploadlist', { archivosZip }); 
        });

    });

});

app.get('/reporte',isAuthenticated,(req,res)=>{
    res.render('reporte');
});


app.get('/reportelist/:startDate/:endDate',isAuthenticated,(req,res)=>{
    const startDate=new Date(req.params.startDate);
    const endDate=new Date(req.params.endDate);
    const query ='Select equipo,fecha,velocidad,archivo from reporte where fecha between ? and ?;';    
    dbreporte.all(query,[startDate.toISOString(), endDate.toISOString()],(err,rows)=>{
        if (err) {
            console.error(err.message);
            res.statusCode = 500;
            res.end('Error en la consulta');
          } else {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            //console.log(JSON.stringify(rows));
            res.end(JSON.stringify(rows));
          }
        //res.render('config',{rows});
    });
});

app.get('/descargarReporte/:startDate/:endDate',isAuthenticated, (req, res) => {
    const startDate = new Date(req.params.startDate);
    const endDate = new Date(req.params.endDate);
  
    
        const query = `SELECT equipo,fecha,velocidad,archivo from reporte WHERE fecha BETWEEN ? AND ?`;
        dbreporte.all(query, [startDate.toISOString(), endDate.toISOString()], (err, rows) => {
          if (err) {
            console.error(err.message);
            res.statusCode = 500;
            res.end('Error en la consulta');
          } else {
            const csvWriter = createCsvWriter({
              path: 'reporte.csv',
              header: [
                { id: 'equipo', title: 'Equipo' },
                { id: 'fecha', title: 'Fecha' },
                { id: 'velocidad', title: 'Velocidad' },
                { id: 'archivo', title: 'Nombre Archivo' }
              ]
            });
  
            csvWriter.writeRecords(rows)
              .then(() => {
                console.log('Archivo CSV generado correctamente');
                res.download('reporte.csv', () => {
                  fs.unlink('reporte.csv', (err) => {
                    if (err) {
                      console.error('Error al eliminar el archivo CSV:', err);
                    }
                  });
                });
              })
              .catch((error) => {
                console.error('Error al generar el archivo CSV:', error);
                res.statusCode = 500;
                res.end('Error al generar el archivo CSV');
              });
          }
        });      
  });

  app.get('/descargarImagenes/:startDate/:endDate',isAuthenticated,(req,res)=>{
    const startDate = new Date(req.params.startDate);
    const endDate = new Date(req.params.endDate);
  
    
        const query = `SELECT equipo,fecha,velocidad,archivo from reporte WHERE fecha BETWEEN ? AND ?`;
        dbreporte.all(query, [startDate.toISOString(), endDate.toISOString()],(err,rows)=>{
            if (err) {
                console.error(err.message);
                res.statusCode = 500;
                res.end('Error en la consulta');
              }else{
                const rutaCarpeta='../fotomultas/reporte';
                const nombreArchivoZip='archivo.zip';

                const salida = fs.createWriteStream(nombreArchivoZip);
                const archivoZip = archiver('zip');

                salida.on('close', () => {
                    console.log('El archivo comprimido se ha creado correctamente.');
                    res.download(nombreArchivoZip, (err) => {
                    if (err) {
                        console.error('Error al descargar el archivo comprimido:', err);
                    }
                    fs.unlink(nombreArchivoZip, (err) => {
                        if (err) {
                        console.error('Error al eliminar el archivo comprimido:', err);
                        }
                    });
                    });
                }); 

                archivoZip.pipe(salida);
                for (const row of rows) {
                  const archivo = path.join(rutaCarpeta, row.archivo);
                  console.log(archivo);
                  archivoZip.file(archivo, { name: row.archivo });
                }
                archivoZip.finalize();


              }
        });
  });

app.get('/reporteimg/:nombreArchivo',isAuthenticated,(req,res)=>{
    const nombreArchivo = req.params.nombreArchivo;
    //let rutaCarpeta = 'E:/Trabajos/BlueNet/FotoMultas/reporte';
    let rutaCarpeta = '/home/roacho/fotomultasinstall/fotomultas/reporte';
    

  const rutaArchivo = path.join(rutaCarpeta, nombreArchivo);

  if (fs.existsSync(rutaArchivo)) {
    const mimeType = mime.getType(rutaArchivo);
    res.setHeader('Content-Type', mimeType);
    res.sendFile(rutaArchivo, (err) => {
      if (err) {
        console.error('Error al enviar el archivo:', err);
        res.statusCode = 500;
        res.end('Error al enviar el archivo');
      } else {
        console.log('Archivo enviado:', rutaArchivo);
      }
    });
  } else {
    console.error('Archivo no encontrado:', rutaArchivo);
    res.statusCode = 404;
    res.end('Archivo no encontrado');
  }


});


app.get('/livecam',isAuthenticated,(req,res)=>{
    const query ="Select * from config where id='ipcamara';"; 
    db.get(query,(err,row)=>{
        if (err){
            console.error(err.message);
            return;
        }

        res.render('livecam',{rowData:row});

        
    });
});

app.get('/resetservice',isAuthenticated,(req,res)=>{
    exec(`sudo ../fotomultas/restart.sh`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error al ejecutar el script: ${error}`);
            res.render("restart",{mensaje:error});
        }
        res.render("restart",{mensaje:'Servicio reiniciado'});
        
    });
    
    // exec('pkill -f main.py',(error,stdout,stderr)=>{
    //     if (error) {
    //         console.error(`Error al cerrar el proceso: ${error}`);
    //         res.render("restart",{mensaje:error});
    //       }
    //       exec(`sudo ../fotomultas/start-sh`, (error, stdout, stderr) => {
    //         if (error) {
    //           console.error(`Error al ejecutar el script: ${error}`);
    //           res.render("restart",{mensaje:error});
    //         }
    //         res.render("restart",{mensaje:'Servicio reiniciado'});
            
    //       });
    // });
});

const port=process.env.PORT ||  3000;
app.listen(port,()=>{
    console.log('Server is running on port ${port}');
});