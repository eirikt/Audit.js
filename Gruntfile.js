module.exports = function (grunt) {

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
                    'echo Essential grunt tasks are:',
                    'echo   bower     (install client dependencies)',
                    'echo   mongodb   (start MongoDB)   (blocking command)',
                    'echo   node      (start Node.js)   (blocking command)'
                ].join('&&')
            },
            bower: {
                options: { stdout: true, stderr: true, failOnError: true },
                command: 'bower install'
            },
            createDataDir: {
                options: { stdout: true },
                command: [
                    'mkdir data',
                    'cd data',
                    'mkdir db'
                ].join('&&')
            },
            mongod: {
                options: { stdout: true, stderr: true, failOnError: true },
                command: 'mongod.exe --dbpath data/db'
            },
            // TODO: does not work => "Warning: stdout maxBuffer exceeded. Use --force to continue."
            node: {
                //execOptions: {
                //encoding: 'utf8',
                //timeout: 0,
                //    maxBuffer: 4096//,
                //killSignal: 'SIGTERM'
                //},
                options: {
                    stdout: true,
                    stderr: true,
                    failOnError: true
                },
                command: [
                    'echo Starting Node.js (4GB max process size/max garbage size) ...',
                    'node --max-old-space-size=4096 server/scripts/server.js'
                ].join('&&')
            }
        },

        jshint: {
            all: [
                //'Gruntfile.js'
                //'server/scripts/*.js'
                'client/scripts/*.js'
                //'test/spec/**/*.js'
            ],
            options: {
                //reporter: 'jslint',
                reporter: 'checkstyle',
                //reporter: require('jshint-stylish'),

                //reporterOutput: 'dist/jshint.xml',

                browser: true,
                jquery: true,
                node: true,

                bitwise: true,
                camelcase: true,
                curly: true,
                eqeqeq: true,
                es3: false,
                forin: true,
                freeze: true,
                immed: true,
                indent: false,
                latedef: true,
                newcap: true,
                noarg: true,
                noempty: true,
                nonbsp: true,
                nonew: true,
                plusplus: true,
                //qoutmark: true, // Not forcing consistent use of 'single' or 'double' as of now ...
                undef: true,
                unused: true,
                strict: true,
                trailing: true,
                maxparams: 6,
                maxdepth: 3,
                maxstatements: 20,
                maxcomplexity: 7,
                maxlen: 180,

                laxcomma: true,

                globals: {
                    require: false,
                    define: false,
                    prettyprintInteger: false
                }
            },
            build: {
                src: 'client/scripts/**/*.js',
                dest: 'dist/<%= pkg.name %>.min.js'
            }
        },

        mocha: {
            test: {
                src: ['tests/**/*.html']
            }
        },

        jsdoc: {
            dist: {
                src: ['server/scripts/*.js', 'client/scripts/*.js'],
                options: {
                    destination: 'docs'
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');

    grunt.loadNpmTasks('grunt-mocha');
    grunt.loadNpmTasks('grunt-jsdoc');
    grunt.loadNpmTasks('grunt-shell');

    grunt.registerTask('help', ['shell:help']);
    grunt.registerTask('bower', ['shell:bower']);
    grunt.registerTask('mongodb', ['shell:createDataDir', 'shell:mongod']);
    grunt.registerTask('node', ['shell:node']);

    grunt.registerTask('default', ['help']);

    grunt.registerTask('build:travis', ['jshint', 'mocha', 'jsdoc', 'uglify']);
};
