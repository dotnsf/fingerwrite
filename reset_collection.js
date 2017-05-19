//. reset_collection.js

var watson = require( 'watson-developer-cloud' );
var settings = require( './settings' );
var vr3 = watson.visual_recognition({
  api_key: settings.vr_apikey,
  version: 'v3',
  version_date: '2016-05-19'
});

var params1 = {
  collection_id: settings.vr_collection_id
};
vr3.listImages( params1, function( err1, res1 ){
  if( err1 ){ console.log( err1 ); }
  else{
    var images = res1.images;
    for( i = 0; i < images.length; i ++ ){
      var image = images[i];
      var params2 = {
        collection_id: settings.vr_collection_id,
        image_id: image.image_id
      };
      vr3.deleteImage( params2, function( err2, res2 ){
        if( err2 ){ console.log( err2 ); }
      });
    }
  }
});


