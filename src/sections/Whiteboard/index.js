var fs = require('fs');
var io = require('io');
var f1 = require('f1');
var PIXI = require('pixi');
var find = require('dom-select');
var framework = require('../../framework/index');
var Model = require('../../model/model');
var states = require('./states');
var createTabs = require('./util/tabs');
var socketSetup = require('./util/sockets');
var Chatbox = require('./util/chatbox');

var UserManagement = require('./ui/usermanagement/userManagement');
var Toolbar = require('./util/toolbar');
var Cookies = require('cookies-js');

// A model object can all use it to store Application state properties
// Mostly information retrieved on-mass from Database
var AppState = require('../../model/AppState');

// For live Testing purposes
window.APP_STATE = AppState;
window.SHAPES = AppState.Canvas.Shapes;
window.TOOLS = AppState.Tools;
window.USERS = AppState.Users;
module.exports = Section;

function Section() {}

Section.prototype = {

  init: function(req, done) {
    console.log('start init');

    var socket = socketSetup(io, framework, AppState);

    var content = find('#content');

    this.section = document.createElement('div');
    this.section.innerHTML = fs.readFileSync(__dirname + '/index.hbs', 'utf8');
    content.appendChild(this.section);

    createTabs();

    // Inits AppState with Pixi and adds Socket object to AppState objects
    AppState.init(PIXI, socket, find('#whiteboard-container'));

    this.toolbar = new Toolbar({
      whiteboard: '#whiteboard-container',
      tools: {
        select: '#tool-select',
        pencil: '#tool-pencil',
        eraser: '#tool-eraser',
        fill: '#tool-fill',
        shapes: '#tool-shapes',
        line: '#tool-shapes-line',
        ellipse: '#tool-shapes-ellipse',
        rectangle: '#tool-shapes-rectangle',
        text: '#tool-text',
        table: '#tool-table',
        templates: {
          el: '#tool-template',
          flowchart: '',
          uml: ''
        },
        import: '#tool-import',
        color: '#tool-color'
      }
    }, AppState);

    this.animate = new f1().states(states)
                           .transitions(require('./transitions'))
                           .targets({ whiteboard: find('#whiteboard')})
                           .parsers(require('f1-dom'))
                           .init('init');

    Chatbox.init(AppState);
    UserManagement.init(AppState);

    var close = find('#close-whiteboard');

    // close.addEventListener('click', function(e) {
    //   e.preventDefault();
    //   framework.go('/home');
    // }, false)

    console.log('end init');

    setTimeout(function(){
      if(AppState.Socket.nsp != '/home')
        done();
      else{
       framework.go('/home');
      }
    },1000);

  },

  resize: function(w, h) {
  },

  animateIn: function(req, done) {
      this.animate.go('idle', function() {
        done();
      }.bind(this));
  },

  animateOut: function(req, done) {
    this.animate.go('out', function() {
      done();
    }.bind(this));
  },

  destroy: function(req, done) {
    console.log("Destroy!");

    Cookies.expire('username');
    Cookies.expire('create');

    AppState.Socket.emit('disconnect');

    this.section.parentNode.removeChild(this.section);
    done();
  }
};
