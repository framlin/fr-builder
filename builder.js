var restify = require('restify'),
    cvConfig = require('fr-infra').ServerConfig.cvservice,
    ciConfig = require('fr-infra').ServerConfig.ciservice,
    coConfig = require('fr-infra').ServerConfig.coservice,

    fs = require('fs'),

    cvClient = restify.createClient({
        url:'http://' + cvConfig.ip + ':' + cvConfig.port
    }),
    ciClient = restify.createClient({
        url:'http://' + ciConfig.ip + ':' + ciConfig.port
    }),
    coClient = restify.createClient({
        url:'http://' + coConfig.ip + ':' + coConfig.port
    });


function Builder(sitename) {
    console.log(sitename)
    var me = this;

    this.partialIndex = {
        'top' : "",
        'heading' : "",
        'topnav' : "",
        'maintop' : "",
        'bottomnav': "",
        'metanav': "",
        'mainbottom': "",
        'bottom' : ""
    };

    this.articleIndex = {};

    this.loadContent = function loadContent(cbDone) {
        this.loadPartials(function cbPartialsLoaded(){
            me.loadArticles(cbDone);
        });
    };

    this.loadArticles = function loadArticles(cbDone) {
        var articleCount = 0,
            article;

        function finalize() {
            articleCount -= 1;
            if (articleCount === 0) {
                cbDone();
            }
        }

        function createArticleGetter(idx, key) {
            return function(err, res) {
                //assert.ifError(err); // HTTP status code >= 400
                var val = '';
                res.setEncoding('utf8');
                res.on('data', function(chunk) {
                    val += chunk;
                });

                res.on('end', function() {
                    idx[key] = val;
                    finalize();
                });
            };
        }

        function createIndexGetter(idx, key) {
            return function(err, res) {
                //assert.ifError(err); // HTTP status code >= 400
                var val = '';
                res.setEncoding('utf8');
                res.on('data', function(chunk) {
                    val += chunk;
                });

                res.on('end', function() {
                    idx[key] = val;
                    finalize();
                });

            };
        }

        function crateCOGetter(article) {
            return function cbCOHandling(err, req) {
                req.on('result', createArticleGetter(me.articleIndex, article));
            };
        }

        function crateCOIndexGetter(article) {
            return function cbCOHandling(err, req) {
                req.on('result', createIndexGetter(me.articleIndex, article));
            };
        }

        function coIndexHandler(err, req) {
            var articleIndex = {},
                article;

            req.on('result', function cbIndexResult(err, res){

                var val = '';
                res.on('data', function(chunk) {
                    val += chunk;
                });

                res.on('end', function() {
                    articleIndex = JSON.parse(val);

                    for (article in articleIndex) {
                        articleCount += 1;
                        coClient.get(articleIndex[article], crateCOIndexGetter(article));
                    }
                });
            });
        }

        coClient.get('/co/'+sitename+'/index/article', coIndexHandler);
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

    this.coArticle = function coArticle(ctx, site, articlePath) {
        coClient.get('/co/'+site+'/article/'+articlePath, this.page(ctx));
    };

    this.ciStyle = function ciStyle(ctx, site, stylePath) {
        ciClient.get('/ci/'+site+'/style/'+stylePath, this.createCIHandler(ctx, 'text/css', 'utf8'));
    };

    this.ciPartial = function ciPartial(ctx, partialPath) {
        ciClient.get('/ci/'+sitename+'/partial/'+partialPath, this.createCIHandler(ctx, 'text/html', 'utf8'));
    };

    this.ciImage = function ciImage(ctx, imagePath) {
        ciClient.get('/ci/'+sitename+'/image/'+imagePath, this.createCIHandler(ctx, 'image/png'));
    };

    this.ciFont = function ciFont(ctx, fontPath) {
        ciClient.get('/ci/font/'+fontPath, this.createCIHandler(ctx, 'application/x-font-opentype'));
    };

    /**
     * @callback: 'this' is the calling router
     */
    this.home = function home() {
        this.res.writeHead(200, {
            'Content-Type': 'text/html'
        });
        this.res.write(me.partialIndex.top);
        this.res.write(me.partialIndex.heading);
        this.res.write(me.partialIndex.maintop);
        this.res.write(me.partialIndex.topnav);
        this.res.write(me.articleIndex.home);
        this.res.write(me.partialIndex.bottomnav);
        this.res.write(me.partialIndex.metanav);
        this.res.write(me.partialIndex.mainbottom);
        this.res.write(me.partialIndex.bottom);
        this.res.end();
    };


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
        this.res.write(me.articleIndex.impressum);
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
        this.res.write(me.articleIndex.disclaimer);
        this.res.write(me.partialIndex.bottomnav);
        this.res.write(me.partialIndex.metanav);
        this.res.write(me.partialIndex.mainbottom);
        this.res.write(me.partialIndex.bottom);
        this.res.end();
    };
    /**
     * @callback: 'this' is the calling router
     */
    this.about = function about() {
        this.res.writeHead(200, {
            'Content-Type': 'text/html'
        });
        this.res.write(me.partialIndex.top);
        this.res.write(me.partialIndex.heading);
        this.res.write(me.partialIndex.maintop);
        this.res.write(me.partialIndex.topnav);
        this.res.write(me.articleIndex.about);
        this.res.write(me.partialIndex.bottomnav);
        this.res.write(me.partialIndex.metanav);
        this.res.write(me.partialIndex.mainbottom);
        this.res.write(me.partialIndex.bottom);
        this.res.end();
    };
}


const PARTIALS_POSTFIX = '.html';

function load(path, partial) {
    var content = fs.readFileSync(path + partial + PARTIALS_POSTFIX, {encoding: 'utf-8'});

    return content;
}

function walk (dir) {
    var result = [],
        list = fs.readdirSync(dir);

    list.forEach(function cbEach(file) {
        file = dir + '/' + file;
        var stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            result = result.concat(walk(file));
        }
        else {
            result.push(file);
        }
    });
    return result;
}

function loadAllPartials(path) {
    var partials = walk(path),
        i,
        partial,
        key,
        pathEnd,
        postfixStart,
        result = {};

    for (i = 0; i< partials.length; i += 1) {
        partial = partials[i];
        pathEnd = partial.lastIndexOf('/');
        postfixStart = partial.lastIndexOf('.');
        key = partial.substring(pathEnd +1, postfixStart);
        result[key] = fs.readFileSync(partial, {encoding: 'utf-8'});
    }
    return result;
}

function loadAllArticle(path) {
    var articles = walk(path),
        i,
        article,
        key,
        pathEnd,
        postfixStart,
        result = {};

    for (i = 0; i< articles.length; i += 1) {
        article = articles[i];
        pathEnd = article.lastIndexOf('/');
        postfixStart = article.lastIndexOf('.');
        key = article.substring(pathEnd +1, postfixStart);
        result[key] = fs.readFileSync(article, {encoding: 'utf-8'});
    }
    return result;
}

Builder.loadPartial = load;
Builder.loadAllPartials = loadAllPartials;
Builder.loadAllArticle = loadAllArticle;

module.exports = Builder;