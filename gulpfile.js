/**
 * gulpfile.js
 */
var gulp = require('gulp'),
  browserify = require('browserify'),
  watchify = require('watchify'),
  sass = require('gulp-sass'),
  livereload = require('livereload'),
  changed    = require('gulp-changed'),
  imagemin   = require('gulp-imagemin'),
  notify = require('gulp-notify'),
  source = require('vinyl-source-stream');

/**
 * config
 *
 */
var dest = "./build";
var src = '.';
var config = {
  browserSync: {
    server: {
      // We're serving the src folder as well
      // for sass sourcemap linking
      baseDir: [dest, src]
    },
    files: [
      dest + "/**",
      // Exclude Map files
      "!" + dest + "/**.map"
    ]
  },
  sass: {
    src: src + "/scss/*.{sass,scss}",
    dest: dest
  },
  images: {
    src: src + "/images/**",
    dest: dest + "/images"
  },
  markup: {
    src: src + "/docs/**",
    dest: dest
  },
  browserify: {
    // Enable source maps
    debug: true,
    // Additional file extentions to make optional
    extensions: ['.coffee'],
    // A separate bundle will be generated for each
    // bundle config in the list below
    bundleConfigs: [{
      entries: src + '/js/app.js',
      dest: dest,
      outputName: 'bundle.js'
    }]
  }
};
/* bundleLogger
   ------------
   Provides gulp style logs to the bundle method in browserify.js
*/
var gutil        = require('gulp-util');
var prettyHrtime = require('pretty-hrtime');
var startTime;
var bundleLogger = {
  start: function(filepath) {
    startTime = process.hrtime();
    gutil.log('Bundling', gutil.colors.green(filepath) + '...');
  },

  end: function(filepath, bytes) {
    var taskTime = process.hrtime(startTime);
    var prettyTime = prettyHrtime(taskTime);
    gutil.log('Bundled', gutil.colors.green(filepath), 'in', gutil.colors.magenta(prettyTime), bytes, "bytes.");
  }
};

function handleErrors() {
  var args = Array.prototype.slice.call(arguments);

  // Send error to notification center with gulp-notify
  notify.onError({
    title: "Compile Error",
    message: "<%= error.message %>"
  }).apply(this, args);

  // Keep gulp from hanging on this task
  this.emit('end');
};

// images
gulp.task('images', function() {
  return gulp.src(config.images.src)
    .pipe(changed(config.images.dest)) // Ignore unchanged files
    .pipe(imagemin()) // Optimize
    .pipe(gulp.dest(config.images.dest));
});

// sass, scss
gulp.task('sass', ['images'], function () {
  return gulp.src(config.sass.src)
    .pipe(sass({
      compass: false,
      bundleExec: true,
      sourcemap: true,
      sourcemapPath: '../scss'
    }))
    .on('error', handleErrors)
    .pipe(gulp.dest(config.sass.dest));
});

// Hack to enable configurable watchify watching
gulp.task('setWatch', function() {
  global.isWatching = true;
});

// browserify task
gulp.task('browserify', function(callback) {

  var bundleQueue = config.browserify.bundleConfigs.length;

  var browserifyThis = function(bundleConfig) {

    var bundler = browserify({
      // Required watchify args
      cache: {}, packageCache: {}, fullPaths: true,
      // Specify the entry point of your app
      entries: bundleConfig.entries,
      // Add file extentions to make optional in your requires
      extensions: config.browserify.extensions,
      // Enable source maps!
      debug: config.browserify.debug
    });

    var bundle = function() {
      // Log when bundling starts
      bundleLogger.start(bundleConfig.outputName);

      return bundler
        .bundle()
        // Report compile errors
        .on('error', handleErrors)
        // Use vinyl-source-stream to make the
        // stream gulp compatible. Specifiy the
        // desired output filename here.
        .pipe(source(bundleConfig.outputName))
        // Specify the output destination
        .pipe(gulp.dest(bundleConfig.dest))
        .on('end', reportFinished);
    };

    if(global.isWatching) {
      // Wrap with watchify and rebundle on changes
      bundler = watchify(bundler);
      // Rebundle on update
      bundler.on('update', bundle);
    }

    var bytes;
    bundler.on('bytes', function (b) { bytes = b });

    var reportFinished = function() {
      // Log when bundling completes
      bundleLogger.end(bundleConfig.outputName, bytes)

      if(bundleQueue) {
        bundleQueue--;
        if(bundleQueue === 0) {
          // If queue is empty, tell gulp the task is complete.
          // https://github.com/gulpjs/gulp/blob/master/docs/API.md#accept-a-callback
          callback();
        }
      }
    };

    return bundle();
  };

  // Start bundling with Browserify for each bundleConfig specified
  config.browserify.bundleConfigs.forEach(browserifyThis);
});

// Rerun tasks when a file changes
gulp.task('watch', ['setWatch', 'browserify'], function() {
  gulp.watch(config.sass.src, ['sass'])
  gulp.watch(config.images.src, ['images'])
  });

// The default task (called when you run `gulp` from cli)
gulp.task('default', ['watch'])
gulp.task('build', ['browserify', 'sass', 'images']);
