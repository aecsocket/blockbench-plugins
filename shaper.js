(function() {

// Math utils

/**
 * @typedef {"x" | "y" | "z"} Axis
 */

const PI = Math.PI
const HALF_PI = PI / 2.0

/**
 * @param {[number]} a 
 * @param {[number]} b 
 * @returns {[number]}
 */
function add(a, b) {
  return [
    a[0] + b[0],
    a[1] + b[1],
    a[2] + b[2],
  ]
}

/**
 * @param {[number]} a 
 * @param {[number]} b 
 * @returns {[number]}
 */
function sub(a, b) {
  return [
    a[0] - b[0],
    a[1] - b[1],
    a[2] - b[2],
  ]
}

// Form utils

const AXIS_OPTIONS = {
  x: "X",
  y: "Y",
  z: "Z",
}
const CORNER_OPTIONS = {
  8: "8 (octagon)",
  16: "16 (hexadecagon)",
}

const CREATE_SHAPE_SETTINGS = "shaper:create_shape_settings"

class ArgumentError extends Error {
  constructor(message) {
    super(message)
  }
}

// Plugin logic

/** @type {Action} */
let createShapeAction

BBPlugin.register("shaper", {
  title: "Shaper",
  icon: "fa-shapes",
  author: "aecsocket",
  description: "Creates shapes out of cubes according to user-specified parameters",
  version: "1.0.1",
  min_version: "3.0.5",
  variant: "both",
  onload() {
    createShapeAction = new Action("create_shape", {
      name: "Create Shape",
      icon: "fa-shapes",
      description: "Creates the cubes for a shape with specified parameters",
      click() {
        if (!Format.rotate_cubes) {
          Blockbench.showQuickMessage("Cannot create shapes in formats without cube rotation")
          return
        }

        openCreateShape()
      }
    })
    MenuBar.addAction(createShapeAction, "filter")
  },
  onunload() {
    createShapeAction.delete()
  },
})

/**
 * @typedef {object} CreateShapeSettings
 * @property {Axis} axis
 * @property {[number]} origin
 * @property {number} corners
 * @property {number} diameter
 * @property {number} length
 * @property {boolean} is_hollow
 * @property {number} thickness
 * @property {boolean} fit_step
 */

/**
 * @param {CreateShapeSettings} settings 
 */
function createShape(settings) {
  if (!(AXIS_OPTIONS.hasOwnProperty(settings.axis))) {
    throw new ArgumentError("Axis must be `x`, `y` or `z`")
  }

  if (settings.corners % 2 !== 0) {
    throw new ArgumentError("Corners must be a multiple of 2")
  }

  if (settings.corners < 1) {
    throw new ArgumentError("Must have at least 6 corners")
  }

  if (settings.diameter <= 0.0) {
    throw new ArgumentError("Diameter must be greater than 0.0")
  }

  if (settings.length <= 0.0) {
    throw new ArgumentError("Length must be greater than 0.0")
  }

  if (settings.is_hollow && settings.thickness > settings.diameter / 2.0) {
    throw new ArgumentError("Thickness must be less than or equal to the radius")
  }

  Undo.initEdit({ outliner: true, elements: [] })

  const group = new Group("shape").addTo(Group.selected).init()
 
  // generate a `numCorners`-sided polygon
  const axis = settings.axis
  const origin = settings.origin
  const numCorners = settings.corners

  // calculate fitting
  // fitting automatically rotates the shape by half an angle step,
  // and adjusts the radius/diameter to make the shape still fit inside
  // the original radius/diameter that the user entered
  const angleStep = (2.0 * PI) / numCorners;
  let diameter
  let angleStart
  if (settings.fit_step) {
    let point1 = [ 1.0, 0.0 ]
    let point2 = [ Math.cos(angleStep), Math.sin(angleStep) ]
    let pointM = [ (point1[0] + point2[0]) / 2.0, (point1[1] + point2[1]) / 2.0 ]
    let ratio = Math.sqrt(pointM[0] * pointM[0] + pointM[1] * pointM[1])
    diameter = settings.diameter * ratio
    angleStart = angleStep / 2.0
  } else {
    diameter = settings.diameter
    angleStart = 0.0
  }
  const radius = diameter / 2.0

  const length = settings.length
  const halfLength = length / 2.0

  const markerColor = Math.floor(Math.random() * markerColors.length)
  const thickness = settings.thickness
  const halfThickness = thickness / 2.0
  // https://www.calculatorsoup.com/calculators/geometry-plane/polygon.php
  const side = 2.0 * radius * Math.tan(PI / numCorners)
  const halfSide = side / 2.0

  function addCube(halfExtent, position, angle) {
    // normalize the rotation
    while (angle >= HALF_PI) {
      angle -= HALF_PI
      // every 90 degrees, rotate the half extents by 90 degrees clockwise
      // apply transform (y, -x)
      // rotate along the...
      switch (axis) {
        case "x":
          // y/z plane
          // we DO negate position, but do NOT negate half extents
          halfExtent = [ halfExtent[0], halfExtent[2], halfExtent[1] ]
          position = [ position[0], position[2], -position[1] ]
          break
        case "y":
          // x/z plane
          halfExtent = [ halfExtent[2], halfExtent[1], halfExtent[0] ]
          position = [ position[2], position[1], -position[0] ]
          break
        case "z":
          // x/y plane
          halfExtent = [ halfExtent[1], halfExtent[0], halfExtent[2] ]
          position = [ position[1], -position[0], position[2] ]
          break
      }
    }

    // angle is now < 90.0 degrees
    if (angle > HALF_PI / 2.0) {
      // normalize angle from [0..90.0] to [-45.0..45.0]
      angle = angle - HALF_PI
    }

    const min = sub(position, halfExtent)
    const max = add(position, halfExtent)
    const cube = new Cube({
      name: group.name,
      from: add(origin, min),
      to: add(origin, max),
      rotation: {
        origin: origin.slice(),
        axis: axis,
        angle: angle * (180.0 / PI), // radians to degrees
      },
    }).addTo(group).init()
    cube.setColor(markerColor)
  }

  if (settings.is_hollow) {
    // there are `n` cubes
    // all cubes are the same size, with different offsets
    let halfExtent
    let offset
    switch (axis) {
      case "x":
        halfExtent = [ halfLength, halfThickness, halfSide ]
        offset = [ 0.0, radius - halfThickness, 0.0 ]
        break
      case "y":
        halfExtent = [ halfThickness, halfLength, halfSide ]
        offset = [ radius - halfThickness, 0.0, 0.0 ]
        break
      case "z":
        halfExtent = [ halfThickness, halfSide, halfLength ]
        offset = [ radius - halfThickness, 0.0, 0.0 ]
        break
    }

    for (let i = 0; i < numCorners; i++) {
      addCube(halfExtent, offset, angleStep * i + angleStart)
    }
  } else {
    // there are `n / 2` cubes, since one cube can contribute to 2 exterior faces on the shape
    // all cubes are the same size, with no offset
    let halfExtent
    switch (axis) {
      case "x":
        halfExtent = [ halfLength, radius, halfSide ]
        break
      case "y":
        halfExtent = [ radius, halfLength, halfSide ]
        break
      case "z":
        halfExtent = [ radius, halfSide, halfLength ]
        break
    }

    for (let i = 0; i < numCorners / 2; i++) {
      addCube(halfExtent, [ 0.0, 0.0, 0.0 ], angleStep * i + angleStart)
    }
  }

  group.openUp().select()

  Undo.finishEdit("Create shape", { outliner: true, elements: selected, selection: true })
}

function openCreateShape() {
  /** @type {CreateShapeSettings} */
  let lastSettings = {
    axis: "x",
    origin: [ 8.0, 8.0, 8.0 ],
    corners: 16,
    diameter: 1.0,
    is_hollow: true,
    thickness: 0.25,
    length: 4.0,
    fit_step: false,
  }
  try {
    lastSettings = JSON.parse(localStorage.getItem(CREATE_SHAPE_SETTINGS)) || lastSettings
  } catch (ex) {}
  
  /**
   * @param {CreateShapeSettings} form
   */
  function confirm(form) {
    dialog.hide()

    try {
      createShape(form)
    } catch (ex) {
      if (ex instanceof ArgumentError) {
        Blockbench.showMessageBox({
          title: "Invalid argument",
          message: ex.message,
        })
        return
      } else {
        throw ex
      }
    }

    localStorage.setItem(CREATE_SHAPE_SETTINGS, JSON.stringify(form))
  }

  const dialog = Format.rotation_limit ? new Dialog({
    title: "Shape settings",
    id: "shape_settings",
    form: {
      axis:      { label: "Axis",      type: "select",   value: lastSettings.axis,      options: AXIS_OPTIONS },
      origin:    { label: "Origin",    type: "vector",   value: lastSettings.origin     },
      corners:   { label: "Corners",   type: "select",   value: lastSettings.corners,   options: CORNER_OPTIONS },
      diameter:  { label: "Diameter",  type: "number",   value: lastSettings.diameter,  min: 0.0 },
      length:    { label: "Length",    type: "number",   value: lastSettings.length,    min: 0.0 },
      is_hollow: { label: "Is Hollow", type: "checkbox", value: lastSettings.is_hollow  },
      thickness: { label: "Thickness", type: "number",   value: lastSettings.thickness, min: 0.0 },
      fit_step:  { label: "Fit to next half-angle", type: "checkbox", value: lastSettings.fit_step },
    },
    onConfirm(/** @type {CreateShapeSettings} */ form) {
      if (form.corners > 8 && form.fit_step) {
        Blockbench.showMessageBox({
          title: "Invalid argument",
          message: "Cannot use 'Fit to next half-angle' with more than 8 corners in a Java model",
        })
        return
      }
      confirm(form)
    },
  }) : new Dialog({
    title: "Shape settings",
    id: "shape_settings",
    form: {
      axis:      { label: "Axis",      type: "select",   value: lastSettings.axis,      options: AXIS_OPTIONS },
      origin:    { label: "Origin",    type: "vector",   value: lastSettings.origin     },
      corners:   { label: "Corners",   type: "number",   value: lastSettings.corners    },
      diameter:  { label: "Diameter",  type: "number",   value: lastSettings.diameter,  min: 0.0 },
      length:    { label: "Length",    type: "number",   value: lastSettings.length,    min: 0.0 },
      is_hollow: { label: "Is Hollow", type: "checkbox", value: lastSettings.is_hollow  },
      thickness: { label: "Thickness", type: "number",   value: lastSettings.thickness, min: 0.0 },
      fit_step:  { label: "Fit to next half-angle", type: "checkbox", value: lastSettings.fit_step },
    },
    onConfirm: confirm,
  })
  dialog.show()
}

})()
