(function() {

/**
 * @typedef {"x" | "y" | "z"} Axis
 */

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

const PI = Math.PI
const HALF_PI = PI / 2.0

/** @type {Action} */
let createShapeAction

BBPlugin.register("shaper", {
  title: "Shaper",
  icon: "fa-shapes",
  author: "aecsocket",
  description: "Creates shapes",
  version: "1.0.0",
  min_version: "3.0.5",
  variant: "both",
  onload() {
    createShapeAction = new Action("create_shape", {
      name: "Create Shape",
      icon: "fa-shapes",
      category: "edit",
      click: evt => {
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
  
  let dialog = Format.rotation_limit ? new Dialog({
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
      fit_step:  { label: "Fit to angle step",  type: "checkbox", value: lastSettings.fit_step },
    },
    onConfirm(/** @type {CreateShapeSettings} */ form) {
      dialog.hide()

      try {
        createShape(form)
      } catch (ex) {
        Blockbench.showMessageBox({
          title: "Invalid argument",
          message: ex.message,
        })
        return
      }

      localStorage.setItem(CREATE_SHAPE_SETTINGS, JSON.stringify(form))
    }
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
      fit_step:  { label: "Fit to angle step",  type: "checkbox", value: lastSettings.fit_step },
    },
    onConfirm(/** @type {CreateShapeSettings} */ form) {
      dialog.hide()

      try {
        createShape(form)
      } catch (ex) {
        Blockbench.showMessageBox({
          title: "Invalid argument",
          message: ex.message,
        })
        return
      }

      localStorage.setItem(CREATE_SHAPE_SETTINGS, JSON.stringify(form))
    }
  })
  dialog.show()
}

/**
 * @param {CreateShapeSettings} settings 
 */
function createShape(settings) {
  if (!(AXIS_OPTIONS.hasOwnProperty(settings.axis))) {
    throw new Error("Axis must be `x`, `y` or `z`")
  }

  if (settings.corners % 2 !== 0) {
    throw new Error("Corners must be a multiple of 2")
  }

  if (settings.corners < 6) {
    throw new Error("Must have at least 6 corners")
  }

  if (settings.diameter <= 0.0) {
    throw new Error("Diameter must be greater than 0.0")
  }

  if (settings.length <= 0.0) {
    throw new Error("Length must be greater than 0.0")
  }

  if (settings.is_hollow && settings.thickness > settings.diameter / 2.0) {
    throw new Error("Thickness must be less than or equal to the radius")
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
  const outerAngleStep = (2.0 * PI) / numCorners;
  let diameter
  let angleStart
  if (settings.fit_step) {
    let point1 = [ 1.0, 0.0 ]
    let point2 = [ Math.cos(outerAngleStep), Math.sin(outerAngleStep) ]
    let pointM = [ (point1[0] + point2[0]) / 2.0, (point1[1] + point2[1]) / 2.0 ]
    let ratio = Math.sqrt(pointM[0] * pointM[0] + pointM[1] * pointM[1])
    diameter = settings.diameter * ratio
    angleStart = outerAngleStep / 2.0
  } else {
    diameter = settings.diameter
    angleStart = 0.0
  }
  const radius = diameter / 2.0
  const length = settings.length
  const halfLength = length / 2.0
  const markerColor = Math.floor(Math.random() * markerColors.length)
  const thickness = settings.thickness
  // https://www.calculatorsoup.com/calculators/geometry-plane/polygon.php
  const sideLength = 2.0 * radius * Math.tan(PI / numCorners)
  const sideHalfLength = sideLength / 2.0
  const innerAngleStep = ((numCorners - 2) * PI) / numCorners;

  function addCube(halfExtent, position, angle) {
    // normalize the rotation
    while (angle >= HALF_PI) {
      // every 90 degrees, rotate along the...
      angle -= HALF_PI
      switch (axis) {
        case "x":
          // y/z plane
          halfExtent = [ halfExtent[0], halfExtent[2], halfExtent[1] ]
          position = [ position[0], position[2], position[1] ]
          break
        case "y":
          // x/z plane
          halfExtent = [ halfExtent[2], halfExtent[1], halfExtent[0] ]
          position = [ position[2], position[1], position[0] ]
          break
        case "z":
          // x/y plane
          halfExtent = [ halfExtent[1], halfExtent[0], halfExtent[2] ]
          position = [ position[1], position[0], position[2] ]
          break
      }
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
    // all cubes are the same size
    let halfExtent
    let offset
    switch (axis) {
      case "x":
        halfExtent = [ halfLength, sideLength, thickness ]
        offset = [ 0.0, diameter - thickness, 0.0 ]
        break
      case "y":
        halfExtent = [ sideLength, halfLength, thickness ]
        offset = [ diameter - thickness, 0.0, 0.0 ]
        break
      case "z":
        halfExtent = [ sideLength, thickness, halfLength ]
        offset = [ diameter - thickness, 0.0, 0.0 ]
        break
    }

    for (let i = 0; i < numCorners; i++) {
      addCube(halfExtent, offset, innerAngleStep * i + angleStart)
    }
  } else {
    // there are `n / 2` cubes, since one cube can contribute to 2 exterior faces on the shape
    // all cubes are the same size
    let halfExtent
    switch (axis) {
      case "x":
        halfExtent = [ halfLength, sideHalfLength, radius ]
        break
      case "y":
        halfExtent = [ sideHalfLength, halfLength, radius ]
        break
      case "z":
        halfExtent = [ sideHalfLength, radius, halfLength ]
        break
    }

    for (let i = 0; i < numCorners / 2; i++) {
      addCube(halfExtent, [ 0.0, 0.0, 0.0 ], innerAngleStep * i + angleStart)
    }
  }

  group.openUp().select()

  Undo.finishEdit("Create shape", { outliner: true, elements: selected, selection: true })
}

})()
