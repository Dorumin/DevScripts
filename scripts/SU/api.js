window.api = {};
api.util = {};

api.api = new mw.Api();
api.step = 500;

api.util.chunk = function(arr, size) {
  var chunks = [],
      i = 0,
      n = arr.length;

  while (i < n) {
    chunks.push(arr.slice(i, i += size));
  }

  return chunks;
};

api.get = function(params, raw) {
    return api.api.get($.extend({
        action: 'query',
    }, params))
    .then(function(d) {
        if (raw) return d;
        return d[params.action || 'query'] || d;
    })
};

api.post = function(params) {
    return api.api.post(params);
};

api.query = function(params) {
    return api.get(params);
};

api._callagain = function(params, offset, sum) {
    return api.get($.extend(params, {
        offset: offset
    }), true).then(function(results) {
        var cont = results['query-continue'] || results['continue'];

        sum = sum.concat(Object.values(results[params.action || 'query'])[0]);

        if (!cont) {
            return sum;
        }

        return api._callagain(params, offset + api.step, sum);
    });
};


api.query.recursive = function(params) {
    return api._callagain(params, 0, []);
};

api.sequence = function(list, fn, index, sum) {
    index = index || 0;
    sum = sum || [];
    return api.get(fn(list[index])).then(function(results) {
        sum.push(results);
        index++;
        if (list[index]) {
            return api.sequence(list, fn, index, sum);
        }
        return sum;
    });
};

// Array, how many to process, function(resolve, reject): reject cancels execution of any further elements
api.parallel = function(list, count, fn, delay) {
    var index = 0,
    i = count,
    promises = [],
    call = function() {
        var item = list[index++];
        return Promise.all([
            fn(item),
            new Promise(function(res) {
                setTimeout(res, (delay || 0) * count);
            })
        ]).then(function(val) {
            if (list[index]) {
                return call();
            }
            return val[0];
        });
    };
    while (i--) {
        promises.push(call(list, fn));
    }
    return Promise.all(promises);
};

mw.hook('doru.api').fire(api);
