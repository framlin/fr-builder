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


function Builder(localPartials) {
    var me = this,
        partial;


    this.sitename = 'company';

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

    //overwrite framlin base CI
    for (partial in localPartials) {
        this.partialIndex[partial] = localPartials[partial];
    }

    this.articleIndex = {};

    this.loadContent = function loadContent(sitename, next) {
        me.sitename = sitename;
        me.loadPartials(function cbPartialsLoaded(){
            me.loadArticles(next);
        });
    };

    this.loadArticles = function loadArticles(next) {
        var articleCount = 0,
            article;

        function finalize() {
            articleCount -= 1;
            if (articleCount === 0) {
                next();
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

        coClient.get('/co/'+me.sitename+'/index/article', coIndexHandler);
    };




    this.loadPartials = function loadPartials(next) {
        var partialCount = 0,
            partial;

        function finalize() {
            partialCount -= 1;
            if (partialCount === 0) {
                next();
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
                ciClient.get('/ci/'+me.sitename+'/partial/'+partial, crateCIGetter(partial));
            }
        }

    };

    this.createCIHandler = function createCIHandler(router, mimeType, encoding) {
        return function cbCIHandling(err, req) {
            req.on('result', function(err, res) {
                //assert.ifError(err); // HTTP status code >= 400

                router.res.writeHead(200, {
                    'Content-Type': mimeType
                });

                if ((!err) && res) {
                    if (encoding) {
                        res.setEncoding(encoding);
                    }
                    res.on('data', function(chunk) {
                        router.res.write(chunk);
                    });

                    res.on('end', function() {
                        router.res.end();
                    });
                } else {
                    console.log(err);
                }
            });

        };

    }


    this.page = function  page(router)  {
        return function serviceRequest(err, req ) {
            req.on('result', function(err, res) {
                //assert.ifError(err); // HTTP status code >= 400

                router.res.writeHead(200, {
                    'Content-Type': 'text/html'
                });
                router.res.write(me.partialIndex.top);
                router.res.write(me.partialIndex.heading);
                router.res.write(me.partialIndex.maintop);
                router.res.write(me.partialIndex.topnav);
                res.setEncoding('utf8');
                res.on('data', function(chunk) {
                    router.res.write(chunk);
                });

                res.on('end', function() {
                    router.res.write(me.partialIndex.bottomnav);
                    router.res.write(me.partialIndex.metanav);
                    router.res.write(me.partialIndex.mainbottom);
                    router.res.write(me.partialIndex.bottom);
                    router.res.end();
                });
            });
        };
    };

    this.cv = function cv(router) {
        cvClient.get('/cv/list', this.page(router));
    };

    this.cvEntry = function cvEntry(router, cvid) {
        cvClient.get('/cv/'+ cvid, this.page(router));
    };

    this.coArticle = function coArticle(router, site, articlePath) {
        coClient.get('/co/'+site+'/article/'+articlePath, this.page(router));
    };

    this.coAudio = function coAudio(router, site, audioPath) {
        coClient.get('/co/'+site+'/audio/'+audioPath, this.createCIHandler(router, 'audio/ogg'));
    };

    this.ciStyle = function ciStyle(router, site, stylePath) {
        ciClient.get('/ci/'+site+'/style/'+stylePath, this.createCIHandler(router, 'text/css', 'utf8'));
    };

    this.ciPartial = function ciPartial(router, partialPath) {
        ciClient.get('/ci/'+me.sitename+'/partial/'+partialPath, this.createCIHandler(router, 'text/html', 'utf8'));
    };

    this.ciImage = function ciImage(router, imagePath) {
        ciClient.get('/ci/'+me.sitename+'/image/'+imagePath, this.createCIHandler(router, 'image/png'));
    };

    this.ciFont = function ciFont(router, fontPath) {
        ciClient.get('/ci/font/'+fontPath, this.createCIHandler(router, 'application/x-font-opentype'));
    };

    /**
     * @callback: 'this' is the calling router
     */
    this.home = function home() {
        var router = this;
        router.res.writeHead(200, {
            'Content-Type': 'text/html'
        });
        router.res.write(me.partialIndex.top);
        router.res.write(me.partialIndex.heading);
        router.res.write(me.partialIndex.maintop);
        router.res.write(me.partialIndex.topnav);
        router.res.write(me.articleIndex.home);
        router.res.write(me.partialIndex.bottomnav);
        router.res.write(me.partialIndex.metanav);
        router.res.write(me.partialIndex.mainbottom);
        router.res.write(me.partialIndex.bottom);
        router.res.end();
    };


    /**
     * @callback: 'this' is the calling router
     */
    this.impressum = function impressum() {
        var router = this;
        router.res.writeHead(200, {
            'Content-Type': 'text/html'
        });
        router.res.write(me.partialIndex.top);
        router.res.write(me.partialIndex.heading);
        router.res.write(me.partialIndex.maintop);
        router.res.write(me.partialIndex.topnav);
        router.res.write(me.articleIndex.impressum);
        router.res.write(me.partialIndex.bottomnav);
        router.res.write(me.partialIndex.metanav);
        router.res.write(me.partialIndex.mainbottom);
        router.res.write(me.partialIndex.bottom);
        router.res.end();
    };

    /**
     * @callback: 'this' is the calling router
     */
    this.disclaimer = function disclaimer() {
        var router = this;
        router.res.writeHead(200, {
            'Content-Type': 'text/html'
        });
        router.res.write(me.partialIndex.top);
        router.res.write(me.partialIndex.heading);
        router.res.write(me.partialIndex.maintop);
        router.res.write(me.partialIndex.topnav);
        router.res.write(me.articleIndex.disclaimer);
        router.res.write(me.partialIndex.bottomnav);
        router.res.write(me.partialIndex.metanav);
        router.res.write(me.partialIndex.mainbottom);
        router.res.write(me.partialIndex.bottom);
        router.res.end();
    };
    /**
     * @callback: 'this' is the calling router
     */
    this.about = function about() {
        var router = this;
        router.res.writeHead(200, {
            'Content-Type': 'text/html'
        });
        router.res.write(me.partialIndex.top);
        router.res.write(me.partialIndex.heading);
        router.res.write(me.partialIndex.maintop);
        router.res.write(me.partialIndex.topnav);
        router.res.write(me.articleIndex.about);
        router.res.write(me.partialIndex.bottomnav);
        router.res.write(me.partialIndex.metanav);
        router.res.write(me.partialIndex.mainbottom);
        router.res.write(me.partialIndex.bottom);
        router.res.end();
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