(function() {

/**
 * @typedef {"x" | "y" | "z"} Axis
 */

const AXIS_OPTIONS = {
  x: "X",
  y: "Y",
  z: "Z",
}

const AXIS = "shaper:axis"
const ORIGIN = "shaper:origin"
const CORNERS = "shaper:corners"
const DIAMETER = "shaper:diameter"
const IS_HOLLOW = "shaper:is_hollow"
const THICKNESS = "shaper:thickness"
const LENGTH = "shaper:length"

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
 * @typedef {object} CreateShapeForm
 * @property {Axis} axis
 * @property {[number]} origin
 * @property {number} corners
 * @property {number} diameter
 * @property {boolean} is_hollow
 * @property {number} thickness
 * @property {number} length
 */

function openCreateShape() {
  let dialog = new Dialog({
    title: "Shape settings",
    id: "shape_settings",
    form: {
      axis: { label: "Axis", type: "select", options: AXIS_OPTIONS, value: localStorage.getItem(AXIS) || "x" },
      origin: { label: "Origin", type: "vector", value: localStorage.getItem(ORIGIN) || [ 8.0, 8.0, 8.0 ] },
      corners: { label: "Corners", type: "number", value: localStorage.getItem(CORNERS) || 16 },
      diameter: { label: "Diameter", type: "number", value: localStorage.getItem(DIAMETER) || 1.0 },
      is_hollow: { label: "Is Hollow", type: "checkbox", value: localStorage.getItem(IS_HOLLOW) === "true" || false },
      thickness: { label: "Thickness", type: "number", value: localStorage.getItem(THICKNESS) || 0.25 },
      length: { label: "Length", type: "number", value: localStorage.getItem(LENGTH) || 4.0 },
    },
    onConfirm(/** @type {CreateShapeForm} */ form) {
      dialog.hide()

      try {
        console.dir(form)
        createShape({
          axis: form.axis,
          origin: form.origin,
          corners: form.corners,
          diameter: form.diameter,
          is_hollow: form.is_hollow,
          thickness: form.thickness,
          length: form.length,
        })
      } catch (ex) {
        Blockbench.showMessageBox({
          title: "Invalid argument",
          message: ex.message,
        })
        return
      }

      localStorage.setItem(AXIS, form.axis)
      localStorage.setItem(ORIGIN, form.origin)
      localStorage.setItem(CORNERS, form.corners.toString())
      localStorage.setItem(DIAMETER, form.diameter.toString())
      localStorage.setItem(IS_HOLLOW, form.is_hollow.toString())
      localStorage.setItem(THICKNESS, form.thickness.toString())
      localStorage.setItem(LENGTH, form.length.toString())
    }
  })
  dialog.show()
}

/**
 * @param {CreateShapeForm} settings 
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

  if (Format.rotation_limit) {
    const innerAngle = (settings.corners - 2) * 180.0
    if (innerAngle % 22.5 !== 0) {
      throw new Error("Inner angle is of invalid multiple in this format")
    }
  }

  if (settings.diameter <= 0.0) {
    throw new Error("Diameter must be greater than 0.0")
  }

  if (settings.is_hollow && settings.thickness > settings.diameter / 2.0) {
    throw new Error("Thickness must be less than or equal to the radius")
  }

  if (settings.length <= 0.0) {
    throw new Error("Length must be greater than 0.0")
  }

  Undo.initEdit({ outliner: true, elements: [] })

  const group = new Group("shape").addTo(Group.selected).init()
 
  // generate a `numCorners`-sided polygon
  const axis = settings.axis
  const numCorners = settings.corners
  const diameter = settings.diameter
  const radius = diameter / 2.0
  const length = settings.length
  const halfLength = length / 2.0
  // https://www.calculatorsoup.com/calculators/geometry-plane/polygon.php
  const sideLength = 2.0 * radius * Math.tan(Math.PI / numCorners)
  const sideHalfLength = sideLength / 2.0

  for (let i = 0; i < numCorners; i++) {
    // generate a 2D slice through the polygon in the xy plane, with (0, 0) being the center
    // note that this does not actually map to the model's xy axes; this is just local coordinates
    const x = Math.cos(i / numCorners * 2.0 * Math.PI) * radius
    const y = Math.sin(i / numCorners * 2.0 * Math.PI) * radius

    let cornerMinA
    let cornerMaxA
    let cornerMinB
    let cornerMaxB
    switch (axis) {
      case "x":
        // assuming that i = 0,
        // minA and maxA will lie on (?, x * radius, y * radius)
        // minB and maxB will lie on the opposite side of that
        cornerMinA = [ -halfLength,  x,  y ]
        cornerMaxA = [  halfLength,  x,  y ]
        cornerMinB = [ -halfLength, -x, -y ]
        cornerMaxB = [  halfLength, -x, -y ]
        break
      case "y":
        cornerMinA = [  x, -halfLength,  y ]
        cornerMaxA = [  x,  halfLength,  y ]
        cornerMinB = [ -x, -halfLength, -y ]
        cornerMaxB = [ -x,  halfLength, -y ]
        break
      case "z":
        cornerMinA = [  x,  y, -halfLength ]
        cornerMaxA = [  x,  y,  halfLength ]
        cornerMinB = [ -x, -y, -halfLength ]
        cornerMaxB = [ -x, -y,  halfLength ]
        break
    }

    new Cube({
      name: group.name,
      from: cornerMinA.slice(),
      to: cornerMaxB.slice(),
    }).addTo(group).init()
  }

  function addCube(from, to, origin, axis, rotation) {
    while (rotation < -45.0) {
      rotation += 90.0
    }
    while (rotation > 45) {
      rotation -= 90.0
    }
    new Cube({
      name: group.name,
      from: from.slice(),
      to: to.slice(),
      rotation: { origin: origin.slice(), axis: axis, angle: rotation },
    }).addTo(group).init()
  }

  group.openUp().select()

  Undo.finishEdit("Create shape", { outliner: true, elements: selected, selection: true })
}

})()
