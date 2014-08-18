module.exports = function(cors, res) {
    if(cors === true){
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    }else if(typeof cors === 'function'){
      res.set('Access-Control-Allow-Origin',
              cors['Access-Control-Allow-Origin'] || '*');
      res.set('Access-Control-Allow-Methods',
              cors['Access-Control-Allow-Methods'] || 'GET, POST, PUT, DELETE');
      if(cors['Access-Control-Allow-Headers'])
        res.set('Access-Control-Allow-Methods', cors['Access-Control-Allow-Headers']);
    }
}
