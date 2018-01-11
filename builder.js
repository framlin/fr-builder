var restify = require('restify-clients'),
    es = require('event-stream'),

    cvConfig = require('fr-infra').ServerConfig.cvservice,
    ciConfig = require('fr-infra').ServerConfig.ciservice,
    coConfig = require('fr-infra').ServerConfig.coservice,

    fs = require('fs'),


    cvClient = restify.createHttpClient({
        url:'http://' + cvConfig.ip + ':' + cvConfig.port
    }),
    ciClient = restify.createHttpClient({
        url:'http://' + ciConfig.ip + ':' + ciConfig.port
    }),
    coClient = restify.createHttpClient({
        url:'http://' + coConfig.ip + ':' + coConfig.port
    });


function Builder(localPartialIndex) {
    var me = this,
        partial;

    this.localPartialIndex = localPartialIndex;
    this.topPartials = [
        '/ci/not-used-for-partials/partial/top',
        '/ci/not-used-for-partials/partial/heading',
        '/ci/not-used-for-partials/partial/maintop',
        '/ci/not-used-for-partials/partial/topnav'
    ];
    this.bottomPartials = [
        '/ci/not-used-for-partials/partial/bottomnav',
        '/ci/not-used-for-partials/partial/metanav',
        '/ci/not-used-for-partials/partial/mainbottom',
        '/ci/not-used-for-partials/partial/bottom'
    ];

    this.sitename = 'company';


    //TODO rename it to setSitename - without next -
    this.loadContent = function loadContent(sitename, next) {
        me.sitename = sitename;
        next();
    };


    this.connectTo = function connectTo(router, mimeType, encoding) {
        return function cbConnector(err, req) {
            req.on('result', function(err, res) {
                //assert.ifError(err); // HTTP status code >= 400

                router.res.writeHead(200, {
                    'Content-Type': mimeType
                });

                if ((!err) && res) {
                    if (encoding) {
                        res.setEncoding(encoding);
                    }
                    res.pipe(router.res);
                } else {
                    console.log(err);
                }
            });

        };

    };

    this.embedd = function embedd(router, partialUrls) {

        if (typeof partialUrls === 'string'){
            partialUrls = [partialUrls];
        }

        var partials = this.topPartials.concat(partialUrls).concat(this.bottomPartials);


        fetchPartials(this.localPartialIndex, partials, router);

    };


    this.coAudio = function coAudio(router, site, audioPath) {
        coClient.get('/co/'+site+'/audio/'+audioPath, this.connectTo(router, 'audio/ogg'));
    };

    this.ciStyle = function ciStyle(router, site, stylePath) {
        ciClient.get('/ci/'+site+'/style/'+stylePath, this.connectTo(router, 'text/css', 'utf8'));
    };

    this.ciPartial = function ciPartial(router, partialPath) {
        ciClient.get('/ci/not-used-for-partials/partial/'+partialPath, this.connectTo(router, 'text/html', 'utf8'));
    };

    this.ciImage = function ciImage(router, imagePath) {
        ciClient.get('/ci/'+me.sitename+'/image/'+imagePath, this.connectTo(router, 'image/png'));
    };

    this.coImage = function coImage(router, site, imagePath) {
        coClient.get('/co/'+site+'/images/'+imagePath, this.connectTo(router, 'image/png'));
    };

    this.ciFont = function ciFont(router, fontPath) {
        ciClient.get('/ci/font/'+fontPath, this.connectTo(router, 'application/x-font-opentype'));
    };



    this.cv = function cv(router) {
        this.embedd(router, '/cv/list');
    };

    this.cvEntry = function cvEntry(router, cvid) {
        this.embedd(router, '/cv/'+ cvid);
    };

    this.coArticle = function coArticle(router, site, articlePath) {
        this.embedd(router, '/co/'+site+'/article/'+articlePath);
    };





    /**
     * @callback: 'this' is the calling router
     */
    this.home = function home() {
        me.embedd(this, '/co/'+me.sitename+'/article/home');
    };


    /**
     * @callback: 'this' is the calling router
     */
    this.impressum = function impressum() {
        me.embedd(this, '/co/company/article/impressum');
    };

    /**
     * @callback: 'this' is the calling router
     */
    this.disclaimer = function disclaimer() {
        me.embedd(this, '/co/company/article/disclaimer');
    };
    /**
     * @callback: 'this' is the calling router
     */
    this.about = function about() {
        me.embedd(this, '/co/company/article/about');
    };
}


function createHandle(localPartials, url) {
    var sections = url.split('/'),
        service = sections[1],
        resourceName = sections[sections.length -1],
        result = {
            client: null, 
            url: url,
            readable:null
        };

    if (localPartials && (resourceName in localPartials)) {
        result.readable = fs.createReadStream(localPartials[resourceName]);
    } else {
        switch (service) {
            case 'ci':
                result.client = ciClient;
                break;
            case 'co':
                result.client = coClient;
                break;
            case 'cv':
                result.client = cvClient;
                break;
        }
    }

    return result;
}

function fetchPartials(localPartials, partials, router) {
    var readables = [];
    //initialize ALL readables with null, so that we later can check,
    //that all readables ars set and we can start to read them
    //one after another ("synchronized serial")
    partials.forEach(function cbMapPartials(val, idx, arr) {
        readables.push(null);
    });

    router.res.writeHead(200, {
        'Content-Type': 'text/html'
    });

    //now start to set the readables
    partials.forEach(function cbMapPartials(val, idx, arr) {
        var handle = createHandle(localPartials, val);

        if (handle.client) {
            fetch(handle.url, idx, readables, router, handle.client);
        } else {
            setReadable(readables, idx, handle.readable, router);
        }
    });

}

function readFrom(readables, idx, router) {
    var through = es.through(write, end);

    function write(data) {
        router.res.write(data);
    }

    function end() { //optional
        if (idx < (readables.length - 1)) {
            readFrom(readables, idx + 1, router);
        } else {
            router.res.end();
        }
    }

    readables[idx].pipe(through);
}

/**
 *
 * @param readables
 *          has to be an array, that is initially contains only NULL-values,
 *          that will be replayed by this method with readables.
 *          If all NULLs are replaced, (recursive) reading from the readables will be started
 *          with the 0-th readable
 * @param idx
 *          index of the readable within the readables-array
 * @param res
 *          the readable
 * @param router
 *          the writable
 */
function setReadable(readables, idx, res, router) {
    var full = true;
    readables[idx] = res;
    readables.forEach(function cbMap(val, idx, arr) {
        if (val === null) {
            full = false;
            return false;
        }
        return true;
    });
    if (full) {
        readFrom(readables, 0, router);
    }
}

function fetch(partial, idx, readables, router, client) {
    client.get(partial, function cbPump(err, req) {
        req.on('result', function cbFetched(err, res) {
            setReadable(readables, idx, res, router);
        });
    });
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

function listAllPartials(path) {
    var partials = walk(path),
        i,
        partial,
        key,
        pathEnd,
        postfixStart,
        postfix,
        result = {};

    for (i = 0; i< partials.length; i += 1) {
        partial = partials[i];
        postfixStart = partial.lastIndexOf('.');
        postfix = partial.substring(postfixStart + 1);
        if (postfix === 'html') {
            pathEnd = partial.lastIndexOf('/');
            key = partial.substring(pathEnd +1, postfixStart);
            result[key] = partial;
        }
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
Builder.listAllPartials = listAllPartials;
Builder.loadAllArticle = loadAllArticle;

module.exports = Builder;