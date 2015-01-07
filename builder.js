var restify = require('restify'),

    PARTIAL_COUNT = 5,
    cvClient = restify.createClient({
        url: 'http://127.0.0.1:8089'
    }),
    ciClient = restify.createClient({
        url: 'http://127.0.0.1:8088'
    });



function Builder() {
    var me = this;
    this.partialIndex = {
        top: '',
        bottom: '',
        showcases: '',
        disclaimer: '',
        impressum: ''
    };

    this.loadPartials = function loadPartials(cbDone) {
        var partialCount = PARTIAL_COUNT;

        function finalize() {
            partialCount -= 1;
            if (partialCount === 0) {
                cbDone();
            }
        }

        function createPartialGetter(partialIndex, key) {
            return function(err, res) {
                //assert.ifError(err); // HTTP status code >= 400
                var val = '';
                res.setEncoding('utf8');
                res.on('data', function(chunk) {
                    val += chunk;
                });

                res.on('end', function() {
                    partialIndex[key] = val;
                    finalize();
                });
            };
        }

        ciClient.get('/ci/partial/top',function cbCIHandling(err, req) {
            req.on('result', createPartialGetter(me.partialIndex, 'top'));
        });

        ciClient.get('/ci/partial/bottom',function cbCIHandling(err, req) {
            req.on('result', createPartialGetter(me.partialIndex, 'bottom'));
        });

        ciClient.get('/ci/partial/showcases',function cbCIHandling(err, req) {
            req.on('result', createPartialGetter(me.partialIndex, 'showcases'));
        });

        ciClient.get('/ci/partial/disclaimer',function cbCIHandling(err, req) {
            req.on('result', createPartialGetter(me.partialIndex, 'disclaimer'));
        });

        ciClient.get('/ci/partial/impressum',function cbCIHandling(err, req) {
            req.on('result', createPartialGetter(me.partialIndex, 'impressum'));
        });
    };

    this.createCIHandler = function createCIHandler(ctx, mimeType, encoding) {
        return function cbCIHandling(err, req) {
            req.on('result', function(err, res) {
                //assert.ifError(err); // HTTP status code >= 400

                ctx.res.writeHead(200, {
                    'Content-Type': mimeType
                });

                if ((!err) && res) {
                    if (encoding) {
                        res.setEncoding(encoding);
                    }
                    res.on('data', function(chunk) {
                        ctx.res.write(chunk);
                    });

                    res.on('end', function() {
                        ctx.res.end();
                    });
                } else {
                    console.log(err);
                }
            });

        };

    }


    this.page = function  page(ctx)  {
        return function serviceRequest(err, req ) {
            req.on('result', function(err, res) {
                //assert.ifError(err); // HTTP status code >= 400

                ctx.res.writeHead(200, {
                    'Content-Type': 'text/html'
                });
                ctx.res.write(me.partialIndex.top);
                res.setEncoding('utf8');
                res.on('data', function(chunk) {
                    ctx.res.write(chunk);
                });

                res.on('end', function() {
                    ctx.res.write(me.partialIndex.showcases);
                    ctx.res.write(me.partialIndex.bottom);
                    ctx.res.end();
                });
            });
        };
    };

    this.cv = function cv(ctx) {
        cvClient.get('/cv/list', this.page(ctx));
    };

    this.cvEntry = function cvEntry(ctx, cvid) {
        cvClient.get('/cv/'+ cvid, this.page(ctx));
    };

    this.ciStyle = function ciStyle(ctx, stylePath) {
        ciClient.get('/ci/style/'+stylePath, this.createCIHandler(ctx, 'text/css', 'utf8'));
    };

    this.ciPartial = function ciPartial(ctx, partialPath) {
        ciClient.get('/ci/partial/'+partialPath, this.createCIHandler(ctx, 'text/html', 'utf8'));
    };

    this.ciImage = function ciImage(ctx, imagePath) {
        ciClient.get('/ci/image/'+imagePath, this.createCIHandler(ctx, 'image/png'));
    };

    this.ciFont = function ciFont(ctx, fontPath) {
        ciClient.get('/ci/font/'+fontPath, this.createCIHandler(ctx, 'application/x-font-opentype'));
    }


    /**
     * @callback: 'this' is the calling router
     */
    this.impressum = function impressum() {
        this.res.writeHead(200, {
            'Content-Type': 'text/html'
        });
        this.res.write(me.partialIndex.top);
        this.res.write(me.partialIndex.impressum);
        this.res.write(me.partialIndex.showcases);
        this.res.write(me.partialIndex.bottom);
        this.res.end();
    };

    /**
     * @callback: 'this' is the calling router
     */
    this.disclaimer = function disclaimer() {
        this.res.writeHead(200, {
            'Content-Type': 'text/html'
        });
        this.res.write(me.partialIndex.top);
        this.res.write(me.partialIndex.disclaimer);
        this.res.write(me.partialIndex.showcases);
        this.res.write(me.partialIndex.bottom);
        this.res.end();
    };
}




module.exports = new Builder();