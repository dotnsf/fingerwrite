exports.basic_username = 'admin';
exports.basic_password = 'P@ssw0rd';
exports.vr_apikey = '(Visual Recognition API の API Key)';
exports.vr_collection_id = '(Visual Recognition API の collection_id)';
exports.vr_limit = 5;
exports.cloudant_username = '(Cloudant Username)';
exports.cloudant_password = '(Cloudant Password)';
exports.cloudant_db = 'spendb';

if( process.env.VCAP_SERVICES ){
  var VCAP_SERVICES = JSON.parse( process.env.VCAP_SERVICES );
  if( VCAP_SERVICES && VCAP_SERVICES.cloudantNoSQLDB ){
    exports.cloudant_username = VCAP_SERVICES.cloudantNoSQLDB.credentials.username;
    exports.cloudant_password = VCAP_SERVICES.cloudantNoSQLDB.credentials.password;
  }
  if( VCAP_SERVICES && VCAP_SERVICES.watson_vision_combined ){
    exports.vr_apikey = VCAP_SERVICES.watson_vision_combined.credentials.api_key;
  }
}

