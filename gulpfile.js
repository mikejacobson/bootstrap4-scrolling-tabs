var gulp = require('gulp');
var browserSync = require('browser-sync');
var cleancss = require('gulp-clean-css');
var eslint = require('gulp-eslint');
var fs = require('fs');
var header = require('gulp-header');
var include = require('gulp-include');
var rename = require('gulp-rename');
var sass = require('gulp-sass');
var uglify = require('gulp-uglify');

var headerFilePath = 'src/js/header.js';

gulp.task('browser-sync', function () {
  browserSync.init({
    startPath: 'run',
    server: {
      baseDir: './'
    },
    port: 3000,
    ghostMode: false
  });
});

gulp.task('bundlejs', function () {
  return gulp.src('src/js/_main.js')
    .pipe(include())
      .on('error', console.log)
    .pipe(header(fs.readFileSync(headerFilePath, 'utf8')))
    .pipe(rename('jquery.bs4-scrolling-tabs.js'))
    .pipe(gulp.dest('dist'));
});

gulp.task('lintdist', function () {
  return gulp.src('dist/jquery.bs4-scrolling-tabs.js')
    .pipe(eslint())
    .pipe(eslint.format());
});

gulp.task('lintsrc', function () {
  return gulp.src('src/js/*.js')
    .pipe(eslint())
    .pipe(eslint.format());
});

gulp.task('minjs', function () {
  return gulp.src('dist/jquery.bs4-scrolling-tabs.js')
    .pipe(rename('jquery.bs4-scrolling-tabs.min.js'))
    .pipe(uglify())
    .pipe(header(fs.readFileSync(headerFilePath, 'utf8')))
    .pipe(gulp.dest('dist'));
});

gulp.task('mincss', function () {
  return gulp.src('dist/jquery.bs4-scrolling-tabs.css')
    .pipe(rename('jquery.bs4-scrolling-tabs.min.css'))
    .pipe(cleancss())
    .pipe(header(fs.readFileSync(headerFilePath, 'utf8')))
    .pipe(gulp.dest('dist'));
});

gulp.task('sass', function () {
  return gulp.src('src/scss/*.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(header(fs.readFileSync(headerFilePath, 'utf8')))
    .pipe(gulp.dest('dist'));
});


gulp.task('watch', function () {
  gulp.watch('src/scss/*.scss', ['buildcss']);
  gulp.watch('src/js/*.js', ['buildjs', 'buildcss']);
});

gulp.task('buildcss', gulp.series(
  'sass',
  'mincss',
  done => done()
));

gulp.task('buildjs', gulp.series(
  'lintsrc',
  'bundlejs',
  'lintdist',
  'minjs',
  done => done()
));

gulp.task('build', gulp.series(
  'buildcss',
  'buildjs',
  done => done()
));

gulp.task('default', gulp.series(
  'build',
  'browser-sync',
  'watch',
  done => done()
));
