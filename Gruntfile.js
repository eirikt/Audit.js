module.exports = function (grunt) {
    'use strict';

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        shell: {
            help: {
                options: { stdout: true, stderr: true, failOnError: true },
                command: [
                    'echo.',
                    'echo ###########################',
                    'echo ###   <%= pkg.name %> v<%= pkg.version %>   ###',
                    'echo ###########################',
                    'echo.',
                    'echo Essential Grunt tasks are:',
                    'echo   install:client   installs client dependencies via Bower              (requires Git in path)',
                    'echo   test             executes all Mocha tests',
                    'echo   db               starts a MongoDB instance using a local data folder (blocking command)',
                    'echo   run              starts up local Node.js runtime                     (blocking command)'
                ].join('&&')
            },
            'install-client': {
                options: { stdout: true, stderr: true, failOnError: true },
                command: 'node ./node_modules/bower/bin/bower install'
            },
            createDataDir: {
                options: { stdout: true, stderr: true, failOnError: false },
                command: [
                    'mkdir data'
                ].join('&&')
            },
            createDbDir: {
                options: { stdout: true, stderr: true, failOnError: false },
                command: [
                    'cd data',
                    'mkdir db'
                ].join('&&')
            },
            mongod: {
                options: {
                    stdout: true,
                    stderr: true,
                    failOnError: true,
                    execOptions: {
                        maxBuffer: Infinity
                    }
                },
                command: 'mongod.exe --dbpath data/db'
            },
            node: {
                options: {
                    stdout: true,
                    stderr: true,
                    failOnError: true,
                    execOptions: {
                        maxBuffer: Infinity
                    }
                },
                command: [
                    'echo Starting Node.js',
                    'node server/scripts/server.js'
                ].join('&&')
            }
        },

        // Server-side/Node.js specs/tests
        mochaTest: {
            test: {
                options: {
                    reporter: 'spec'
                },
                src: [
                    'test/server/specs/*.spec.js'
                ]
            }
        },

        jshint: {
            all: [
                'Gruntfile.js',
                'server/scripts/*.js',
                'client/scripts/*.js',
                'test/server/specs/*.js'
            ],
            options: {
                //reporter: 'jslint',
                reporter: 'checkstyle',
                //reporter: require('jshint-stylish'),

                //reporterOutput: 'dist/jshint.xml',

                node: true,
                browser: true,
                jquery: true,
                mocha: true,

                bitwise: true,
                camelcase: true,
                curly: true,
                eqeqeq: true,
                //es3: true,        // ES3 not relevant for Node.js
                //es5: true,        // Default
                forin: true,
                freeze: true,
                funcscope: true,
                futurehostile: true,
                globals: false,
                globalstrict: false,
                immed: true,
                indent: true,
                latedef: true,
                newcap: true,
                noarg: true,
                nocomma: true,
                noempty: true,
                nonbsp: true,
                nonew: true,
                plusplus: true,
                //qoutmark: true,   // Not forcing consistent use of 'single' or 'double' as of now ...
                singleGroups: true,
                undef: true,
                //unused: true,     // Don't know how to avoid this one - does not fit with hoisted variables/CommonJS style ...
                strict: true,
                trailing: true,

                maxcomplexity: 30,  // TODO: Target should be 5 or thereabout ...
                maxdepth: 4,
                maxlen: 350,        // I have a laarge screen ...
                maxparams: 14,      // I loove currying ...
                maxstatements: 30   // Default: ...
            }
        },

        jsdoc: {
            dist: {
                src: ['server/scripts/*.js', 'client/scripts/*.js'],
                options: {
                    destination: 'doc'
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-shell');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-jsdoc');

    grunt.registerTask('help', ['shell:help']);
    grunt.registerTask('install:client', ['shell:install-client']);
    grunt.registerTask('test', ['install:client', 'mochaTest']);
    grunt.registerTask('lint', ['jshint']);
    grunt.registerTask('doc', ['jsdoc']);

    grunt.registerTask('build:travis', ['test', 'lint']);
    grunt.registerTask('db', ['shell:createDataDir', 'shell:createDbDir', 'shell:mongod']);
    grunt.registerTask('run', ['shell:node']);

    grunt.registerTask('default', ['help']);
};
