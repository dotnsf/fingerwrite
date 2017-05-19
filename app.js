//. app.js

var express = require( 'express' ),
    basicAuth = require( 'basic-auth-connect' ),
    cfenv = require( 'cfenv' ),
    multer = require( 'multer' ),
    bodyParser = require( 'body-parser' ),
    fs = require( 'fs' ),
    ejs = require( 'ejs' ),
    cloudantlib = require( 'cloudant' ),
    watson = require( 'watson-developer-cloud' ),
    app = express();
var settings = require( './settings' );
var vr3 = watson.visual_recognition({
  api_key: settings.vr_apikey,
  version: 'v3',
  version_date: '2016-05-19'
});
var cloudant = cloudantlib( { account: settings.cloudant_username, password: settings.cloudant_password } );
var spendb = cloudant.db.use( settings.cloudant_db );
var appEnv = cfenv.getAppEnv();

app.use( multer( { dest: './tmp/' } ).single( 'image' ) );
app.use( bodyParser.urlencoded( { extended: true } ) );
app.use( bodyParser.json() );
app.use( express.Router() );
app.use( express.static( __dirname + '/public' ) );

app.all( '/admin*', basicAuth( function( user, pass ){
  return( user === settings.basic_username && pass === settings.basic_password );
}));
app.all( '/training*', basicAuth( function( user, pass ){
  return( user === settings.basic_username && pass === settings.basic_password );
}));

app.post( '/ocr', function( req, res ){
  var imgpath = req.file.path;
  var imgtype = req.file.mimetype;
  //var imgsize = req.file.size;
  var ext = imgtype.split( "/" )[1];
  //var imgfilename = req.file.filename;
  var letter = req.body.letter;
  if( letter ){
    var metadata1 = { "letter": letter };
    var params1 = {
      collection_id: settings.vr_collection_id,
      metadata: metadata1,
      image_file: fs.createReadStream( imgpath )
    };
    vr3.addImage( params1, function( err1, res1 ){
      if( err1 ){ console.log( err1 ); }
      else{
        var image_id = res1.images[0].image_id;
        var img = fs.readFileSync( imgpath );
        var img64 = new Buffer( img ).toString( 'base64' );
        
        var params2 = {
          _id: image_id,
          _attachments: {
            image: {
              content_type: imgtype,
              data: img64
            }
          }
        };
        spendb.insert( params2, image_id, function( err2, body2, header2 ){
          if( err2 ){ console.log( err2 ); }
          fs.unlink( imgpath, function( err ){} );
        });

        var p = JSON.stringify( res1, null, 2 );
        res.write( p );
        res.end();
      }
    });
  }else{
    var params1 = {
      collection_id: settings.vr_collection_id,
      limit: settings.vr_limit,
      image_file: fs.createReadStream( imgpath )
    };
    vr3.findSimilar( params1, function( err1, res1 ){
      if( err1 ){ console.log( err1 ); }
      else{
        var p = JSON.stringify( res1, null, 2 );
        res.write( p );
        res.end();
      }

      fs.unlink( imgpath, function( err ){} );
    });
  }
});

app.get( '/training', function( req, res ){
  var training_template = fs.readFileSync( __dirname + '/public/training.ejs', 'utf-8' );
  var p = ejs.render( training_template, {} );
  res.write( p );
  res.end();
});

app.get( '/admin', function( req, res ){
  var list_template = fs.readFileSync( __dirname + '/public/list.ejs', 'utf-8' );
  var params1 = {
    collection_id: settings.vr_collection_id
  };
  vr3.listImages( params1, function( err1, res1 ){
    if( err1 ){ console.log( err1 ); }
    else{
      var image_ids = [];
      var letters = [];
      var image_urls = [];
      var images = res1.images;
      for( i = 0; i < images.length; i ++ ){
        var image = images[i];
        var image_id = image.image_id;
        var metadata = image.metadata;
        var letter = metadata.letter;
        var image_url = "./getimage?id=" + image_id;

        image_ids.push( image_id );
        letters.push( letter );
        image_urls.push( image_url );
      }

      //. letter でソート 
      for( i = 0; i < letters.length - 1; i ++ ){
        for( j = i + 1; j < letters.length; j ++ ){
          if( letters[i] > letters[j] ){
            var t = letters[i];
            letters[i] = letters[j];
            letters[j] = t;
            t = image_ids[i];
            image_ids[i] = image_ids[j];
            image_ids[j] = t;
            t = image_urls[i];
            image_urls[i] = image_urls[j];
            image_urls[j] = t;
          }
        }
      }

      var p = ejs.render( list_template, { image_ids: image_ids, letters: letters, image_urls: image_urls } );
      res.write( p );
      res.end();
    }
  });
});

app.get( '/getimage', function( req, res ){
  var image_id = req.query.id;
  //var image_url = "//" + settings.cloudant_username + ":" + settings.cloudant_password + "@" + settings.cloudant_username + ".cloudant.com/" + settings.cloudant_db + "/" + image_id + "/image";
  spendb.attachment.get( image_id, "image", function( err1, body1 ){
    res.contentType( 'image/png' );
    res.end( body1, 'binary' );
  });
});

app.get( '/check', function( req, res ){
  var image_id = req.query.id;

  //. Cloudant から画像をダウンロード
  spendb.attachment.get( image_id, "image", function( err1, body1 ){
    if( err1 ){
      err1.image_id = "error-1";
      res.write( JSON.stringify( err1 ) );
      res.end();
    }else{
      var filename = 'tmp/' + image_id + '.png';
      fs.writeFileSync( filename, body1 );

      //. ダウンロードした画像で類似画像検索
      var params2 = {
        collection_id: settings.vr_collection_id,
        limit: 10 /*settings.vr_limit*/,
        image_file: fs.createReadStream( filename )
      };
      vr3.findSimilar( params2, function( err2, res2 ){
        if( err2 ){
          err2.image_id = "error-2";
          res.write( JSON.stringify( err2 ) );
          res.end();
        }else{
          var filename = 'tmp/' + res2.image_file;
          fs.unlink( filename );

          //. １位は自分自身として、２位以降の画像とその確信度を調べる
          res2.image_id = image_id;
          res.write( JSON.stringify( res2 ) );
          res.end();
        }
      });
    }
  });
});

app.delete( '/del_image', function( req, res ){
  var id = req.body.id;

  //. Watson Visual Recognition Collection から削除
  var params1 = {
    collection_id: settings.vr_collection_id,
    image_id: id
  };
  vr3.deleteImage( params1, function( err1, res1 ){
    if( err1 ){
      err1.image_id = "error-1";
      res.write( JSON.stringify( err1 ) );
      res.end();
    }

    //. Cloudant から削除
    spendb.get( id, null, function( err2, body2, header2 ){
      if( err2 ){
        err2.image_id = "error-2";
        res.write( JSON.stringify( err2 ) );
        res.end();
      }

      var rev = body2._rev;
      spendb.destroy( id, rev, function( err3, body3, header3 ){
        if( err3 ){
          err3.image_id = "error-3";
          res.write( JSON.stringify( err3 ) );
          res.end();
        }

        body3.image_id = id;
        res.write( JSON.stringify( body3 ) );
        res.end();
      });
    });
  });
});

app.listen( appEnv.port );
console.log( "server stating on " + appEnv.port + " ..." );

