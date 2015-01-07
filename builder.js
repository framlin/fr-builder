var restify = require('restify'),

    cvClient = restify.createClient({
        url: 'http://127.0.0.1:8089'
    }),
    ciClient = restify.createClient({
        url: 'http://127.0.0.1:8088'
    });



function Builder(sitename) {
    console.log(sitename)
    var me = this;
    this.partialIndex = {
        'top' : "",
        'heading' : "",
        'topnav' : "",
        'maintop' : "",
        'impressum': "",
        'bottomnav': "",
        'disclaimer': "",
        'metanav': "",
        'mainbottom': "",
        'bottom' : ""
    };

    this.loadPartials = function loadPartials(cbDone) {
        var partialCount = 0,
            partial;

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

        function crateCIGetter(partial) {
            return function cbCIHandling(err, req) {
                req.on('result', createPartialGetter(me.partialIndex, partial));
            };
        }

        for (partial in this.partialIndex) {
            if (this.partialIndex[partial] === "") {
                partialCount += 1;
                ciClient.get('/ci/'+sitename+'/partial/'+partial, crateCIGetter(partial));
            }
        }

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
                ctx.res.write(me.partialIndex.heading);
                ctx.res.write(me.partialIndex.maintop);
                ctx.res.write(me.partialIndex.topnav);
                res.setEncoding('utf8');
                res.on('data', function(chunk) {
                    ctx.res.write(chunk);
                });

                res.on('end', function() {
                    ctx.res.write(me.partialIndex.bottomnav);
                    ctx.res.write(me.partialIndex.metanav);
                    ctx.res.write(me.partialIndex.mainbottom);
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
        ciClient.get('/ci/'+sitename+'/style/'+stylePath, this.createCIHandler(ctx, 'text/css', 'utf8'));
    };

    this.ciPartial = function ciPartial(ctx, partialPath) {
        ciClient.get('/ci/'+sitename+'/partial/'+partialPath, this.createCIHandler(ctx, 'text/html', 'utf8'));
    };

    this.ciImage = function ciImage(ctx, imagePath) {
        ciClient.get('/ci/'+sitename+'/image/'+imagePath, this.createCIHandler(ctx, 'image/png'));
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
        this.res.write(me.partialIndex.heading);
        this.res.write(me.partialIndex.maintop);
        this.res.write(me.partialIndex.topnav);
        this.res.write(me.partialIndex.impressum);
        this.res.write(me.partialIndex.bottomnav);
        this.res.write(me.partialIndex.metanav);
        this.res.write(me.partialIndex.mainbottom);
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
        this.res.write(me.partialIndex.heading);
        this.res.write(me.partialIndex.maintop);
        this.res.write(me.partialIndex.topnav);
        this.res.write(me.partialIndex.disclaimer);
        this.res.write(me.partialIndex.bottomnav);
        this.res.write(me.partialIndex.metanav);
        this.res.write(me.partialIndex.mainbottom);
        this.res.write(me.partialIndex.bottom);
        this.res.end();
    };
}




module.exports = Builder;