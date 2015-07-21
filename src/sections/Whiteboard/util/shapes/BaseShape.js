'use strict';
var PIXI = require('pixi');
var EVENT = require('../../../../model/model').socketEvents;

module.exports = BaseShape;

// Abstract class, don't instantiate the object to draw anything,
// since this class is meant to represent the Base properties all other
// basic shapes and Complex shapes need, Free hand drawing (pencil) is the exception
function BaseShape(shapeProperties, graphicsType) {
  switch(graphicsType) {
    case 'sprite':
      this.graphics = new PIXI.Sprite();
      break;
    default:
      this.graphics = new PIXI.Graphics();
      break;
  }
  this.highlightShape = new PIXI.Graphics();
  this.selectablePoints = new PIXI.Graphics();
  this.graphics.addChildAt(this.highlightShape, 0);
  this.graphics.addChildAt(this.selectablePoints, 1);
  this.layerLevel = 0;

  this.graphics.scale = this.scale = { x: 1, y: 1 };
};

// Normally called by Shape objects that inherit BaseShape
var getProperties = function() {
  var shapeProperties = {
    _id: this._id,
    originalUserId: this.originalUserId,
    currentUserId: this.currentUserId,
    layerLevel: this.layerLevel,
    rotation: this.rotation,
    interactive: this.interactive,
    scale: this.scale
  };

  return shapeProperties;
};

// Called by shape objects that need to set Base properties
// Eg. BaseShape.prototype.setProperties.call(DerviedShape, {});
var setProperties = function(shapeProperties) {
  // These properties will be set by AppState's Shapes object
  // It will set these properties based on the Session context and
  // User
  this._id = shapeProperties._id || '';
  this.originalUserId = shapeProperties.originalUserId;
  this.currentUserId = shapeProperties.currentUserId;
  this.layerLevel = shapeProperties.layerLevel || 0;

  // This will indicate whether the user has selected this object in the Canvas
  // This is normally toggled when Select tool is selected and User clicks on
  // this shape
  this.selected = false;

  // This will be set by socket events when another participant has selected
  // this object to manipulate
  this.locked = false;

  // Set Graphics specific properties
  this.scale = shapeProperties.scale || { x: 1, y: 1 };
  this.rotation = this.graphics.rotation = shapeProperties.rotation || 0;
  this.interactive = this.graphics.interactive = this.interactive = shapeProperties.interactive || false;
};

// Sets the listeners to handle Movement and Selection as well
var setMoveListeners = function(AppState) {
  var Tools = AppState.Tools;
  var Users = AppState.Users;
  var socket = AppState.Socket;

  // The current position of this Shape, ie. its Top, Left coordinates
  // relative to Canvas' Top, Left coords
  this.origin = {
    x: this.x,
    y: this.y
  };

  // Interactivity allows User's to interact with this shape, the listeners
  // will actually be toggled based on whether interactive is set to true/false
  this.interactive = this.graphics.interactive = true;

  // For Shape UI functionality
  this.attachSelectableArea();

  // Since we don't have event bubbling, we need to have a close relationship between
  // Select tool's mouse events and the selected Shape's events
  this.graphics.mousedown = function(data) {
    console.log('Mouse Down called');
    // Do early return if shape is locked, due to another User manipulating this Shape
    if(this.locked) return;

    //data.originalEvent.preventDefault();
    if(Tools.selected === 'select') {
      this.origin = data.getLocalPosition(this.graphics);
      this.alpha = 0.9;

      // Check if click was within the defined area for selectable UI of the Shape,
      // i.e. not within the center of the Shape, only show UI if its on the outer edge
      if(!this.bounds.contains(this.origin.x, this.origin.y)) {

        // Show the Shape UI graphics around the Shape
        this.showSelectableUI();
      }

      // Set the User who is currently manipulating the Shape,
      // Note: the currentUserId can be different from OriginalUserId
      // if a user other than the current user manipulates this Shape
      // via Socket events
      this.currentUserId = Users.currentUser._id;

      Tools.select.selectedObject = this;

      // Since the Selected tool is the 'Select' tool, if we register a mouse click
      // we should set the selected property to true
      this.selected = true;

      // Since tool is selected we should also highlight the tool
      // Normally highlight() will be defined by Derived tool, since the shape of
      // the highlight tool might vary depending on the Shape, ie. Ellipse or Rectangle
      this.highlight();

      // use socket emit to other User's that this object is selected by this user, and should
      // be locked for them
      socket.emit(EVENT.shapeEvent, 'lockShape', {
          _id: this._id,
          currentUserId: this.currentUserId
        }
      );
    }
    // If the selected tool is Fill tool
    else if(Tools.selected === 'fill') {
      this.graphics.clear();

      // Pass the new Fill color to the Shape's draw method
      this.draw({ fillColor: Tools.fill.fillColor });

      // Emit a modify event, and send the Shape properties
      // We probably should only send the new Color rather than all Shape
      // properties
      socket.emit(EVENT.shapeEvent, 'modify', this.getProperties());

      // Turn interactive back on after clearing Graphics
      this.interactive = this.graphics.interactive = true;
    }
  }.bind(this);

  // Need this for Select tool, since it needs to know if
  // Shape had been moved, thus it will read the this.origin property
  this.graphics.mouseup = function(data) {
    if(Tools.selected === 'select') {
      this.alpha = 1;
      this.origin = {
        x: this.graphics.position.x,
        y: this.graphics.position.y
      };
    }
  }.bind(this);
};

var move = function(vector) {
  this.graphics.position.x = vector.x;
  this.graphics.position.y = vector.y;
};

// Returns the Current graphics container, it can be either a Graphic or Sprite
var getGraphics = function() {
  return this.graphics;
}

// Reveal a UI area around the shape, for user to change Shape properties
var showSelectableUI = function() {
  // Creates a hit area to determine if mouse clicked inside
  // Note: getDimensions() is normally defined by Derived classes that know
  // the dimensions of its Shape
  console.log('SHOWING selectable UI');
  var selectableArea = new PIXI.Rectangle.call(this.bounds);
  this.graphics.addChild(selectableArea)
}

var attachSelectableArea = function(boundaryPolygon) {
  // Default use local bounds of BaseShape + 5;
  if(!boundaryPolygon) boundaryPolygon = this.getBoundary();
  //this.bounds = this.graphics.getLocalBounds();
  console.log(this.bounds);
  console.log(boundaryPolygon);
  // Array of x,y,x,y... points, expands containing Shapes hitArea to allow for
  // selectable UI area
  this.graphics.hitArea = this.bounds;//new PIXI.Rectangle(boundaryPolygon);//new Polygon(this.getBoundary());
}

// Draw the selectable points around the perimeter of the Shape
var drawSelectablePoints = function() {}

// Updates the Shape's localBounds, not including UI child graphics objects
var updateBounds = function() {
  var selectableAreaSize = 20;
  //if(!this.bounds) this.bounds = {};
  console.log('This points to ', this);
  // this.bounds = new PIXI.Polygon([
  //   this.x - selectableAreaSize,
  //   this.y - selectableAreaSize,
  //   this.x + this.width + selectableAreaSize * 2,
  //   this.y + this.height + selectableAreaSize * 2
  // ]);

  this.bounds = new PIXI.Rectangle(
    this.x - selectableAreaSize,
    this.y - selectableAreaSize,
    this.width + selectableAreaSize * 2,
    this.height + selectableAreaSize * 2
  );

}

var getInnerBounds = function() {
  return this.graphics.getLocalBounds();
}

// Gets the Shape's local bounds, not including the UI child graphics objects
var getBoundary = function() {

  if(!this.bounds) this.updateBounds();

  return this.bounds;
}

BaseShape.prototype = {
  // Getter/Setters
  getProperties: getProperties,
  setProperties: setProperties,
  getGraphics: getGraphics,

  // Mouse Events
  setMoveListeners: setMoveListeners,
  move: move,
  moveTo: moveTo,

  // UI indicator methods, will be abstract
  highlight: function() { console.log('called base highlight'); },
  unHighlight: function() { console.log('called base UnHighLight'); },

  // Shape locking/unlocking methods
  lockShape: function(userId) {
    console.log('LOCKing shape');
    this.currentUserId = userId;
    this.highlight(0xFF0000);
    //this.interactive = this.graphics.interactive = false;
    this.locked = true;
  },
  unLockShape: function() {
    console.log('unLOCKing shape');

    this.interactive = this.graphics.interactive = true;
    this.unHighlight();
    this.locked = false;
  },

  /*To Do: Potentially implement methods that shows UI features around the shape */
  getDimensions: function() {
    var bounds = this.graphics.getLocalBounds();

    // Ensure UI shows up within visible area of the Canvas
    if(bounds.x > 5)
      bounds.x = 5;
    if(bounds.y > 5)
      bounds.y = 5;

    // The selectable area should be 5 units more than the shape it contains
    bounds.width += 5;
    bounds.height += 5;

    return bounds;
  },


  /*To Do: Potentially implement methods that shows UI features around the shape */
  showSelectableUI : showSelectableUI,
  drawSelectablePoints: drawSelectablePoints,
  attachSelectableArea: attachSelectableArea,
  getBoundary: getBoundary,
  getInnerBounds: getInnerBounds,
  updateBounds: updateBounds
};





