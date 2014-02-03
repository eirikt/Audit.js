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
                options: { stdout: true, stderr: true, failOnError: true },
                command: [
                    'mkdir data',
                    'cd data',
                    'mkdir db',
                    'cd ..'
                ].join('&&')
            },
            mongod: {
                options: { stdout: true, stderr: true, failOnError: true },
                command: 'mongod.exe --dbpath data/db'
            },
            node: {
                options: { stdout: true, stderr: true, failOnError: true },
                command: [
                    'echo Starting Node.js (4GB max process size/max garbage size) ...',
                    'node --max-old-space-size=4096 server/scripts/server.js'
                ].join('&&')
            }
        },

        jsdoc: {
            dist: {
                src: ['client/scripts/**/*.js', 'test/scripts/**/*.js'],
                options: {
                    destination: 'docs'
                }
            }
        },

        uglify: {
            options: {
                banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
            },
            build: {
                src: 'client/scripts/**/*.js',
                dest: 'dist/<%= pkg.name %>.min.js'
            }
        }
    });

    grunt.loadNpmTasks('grunt-shell');
    grunt.loadNpmTasks('grunt-jsdoc');
    grunt.loadNpmTasks('grunt-contrib-uglify');

    grunt.registerTask('build', ['shell:help']);
    grunt.registerTask('bower', ['shell:bower']);
    grunt.registerTask('mongodb', ['shell:createDataDir', 'shell:mongod']);
    grunt.registerTask('node', ['shell:node']);

    grunt.registerTask('default', ['build']);
};
