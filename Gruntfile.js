'use strict';
module.exports = function(grunt) {
  var autoprefixer = require('autoprefixer');
  var browserSync = require('browser-sync').create();
  var chokidar = require('chokidar');
  var postcss = require('postcss');
  var sass = require('sass');

  // Load all tasks
  require('load-grunt-tasks')(grunt);
  // Show elapsed time
  require('time-grunt')(grunt);

  var jsFileList = [
    'assets/vendor/jroff/dist/jroff.js',
    'assets/vendor/essential.js/essential.js',
    'assets/js/main.js',
    'assets/js/services/*.js',
    'assets/js/behaviors/*.js',
    'assets/vendor/uri.js/src/URI.min.js'
  ];

  grunt.initConfig({
    distPath: 'assets/build',
    sass: {
      options: {
        implementation: sass,
        sourceMap: false
      },
      dev: {
        files: {
          '<%= distPath %>/css/main.css': 'assets/scss/main.scss'
        }
      },
      build: {
        files: {
          '<%= distPath %>/css/main.min.css': 'assets/scss/main.scss'
        }
      }
    },
    concat: {
      options: {
        separator: ';',
      },
      dist: {
        src: [jsFileList],
        dest: '<%= distPath %>/js/scripts.js',
      },
    },
    uglify: {
      dist: {
        files: {
          '<%= distPath %>/js/scripts.min.js': [jsFileList]
        }
      }
    },
    autoprefixer: {
      options: {
        browsers: ['last 2 versions', 'ie 8', 'ie 9', 'android 2.3', 'android 4', 'opera 12']
      },
      dev: {
        options: {
          map: {
            prev: '<%= distPath %>/css/'
          }
        },
        src: '<%= distPath %>/css/main.css'
      },
      build: {
        src: '<%= distPath %>/css/main.min.css'
      }
    },
    modernizr: {
      build: {
        devFile: 'assets/vendor/modernizr/modernizr.js',
        outputFile: 'assets/js/vendor/modernizr.min.js',
        files: {
          'src': [
            ['<%= distPath %>/js/scripts.min.js'],
            ['<%= distPath %>/css/main.min.css']
          ]
        },
        extra: {
          shiv: false
        },
        uglify: true,
        parseFiles: true
      }
    },
    browserSync: {
      dev: {
        options: {
	  open: false,
          server: {
            baseDir: './'
          },
          files: ['<%= distPath %>/css/main.css', '<%= distPath %>/js/scripts.js', 'index.html'],
          watchTask: true
        }
      }
    },
    copy: {
      dist: {
        files: [
          { expand: true, src: ['<%= distPath %>/**'], dest: 'dist/', filter: 'isFile' },
          { src: ['index.html'], dest: 'dist/index.html' },
        ]
      }
    }
  });

  grunt.registerMultiTask('autoprefixer', function() {
    var done = this.async();
    var options = this.options({
      browsers: []
    });
    var src = this.data.src;
    var css = grunt.file.read(src);

    postcss([autoprefixer({ overrideBrowserslist: options.browsers })])
      .process(css, { from: src, to: src, map: false })
      .then(function(result) {
        grunt.file.write(src, result.css);
        grunt.log.ok('1 autoprefixed stylesheet created.');
        done();
      })
      .catch(done);
  });

  grunt.registerTask('browserSync', function() {
    var done = this.async();
    browserSync.init(grunt.config.get('browserSync.dev.options'), done);
  });

  grunt.registerTask('watch', function() {
    this.async();

    chokidar.watch(['assets/scss/*.scss', 'assets/scss/**/*.scss'])
      .on('change', function() {
        grunt.task.run(['sass:dev', 'newer:autoprefixer:dev']);
      });

    chokidar.watch(jsFileList)
      .on('change', function() {
        grunt.task.run(['newer:concat']);
      });
  });

  // Register tasks
  grunt.registerTask('default', [
    'browserSync',
    'watch'
  ]);

  grunt.registerTask('dev', [
    'sass',
    'autoprefixer:dev',
    'concat'
  ]);

  grunt.registerTask('build', [
    // 'jshint',
    'sass',
    'autoprefixer:build',
    'uglify',
    'modernizr',
    'concat',
    'copy'
  ]);
};
