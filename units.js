(function() {

// Form utils

const UNITS = new Map(Object.entries({
    cm: (1 / 100) * 16.0,
    mm: (1 / 1000) * 16.0,
    m:  16.0,
    in: 0.0254 * 16.0,
}))

const CONVERT_SETTINGS = "convert_units:convert_settings"

class ArgumentError extends Error {
  constructor(message) {
    super(message)
  }
}

// Plugin logic

/** @type {Action} */
let button

BBPlugin.register("units", {
  title: "Units",
  author: "aecsocket",
  icon: "fa-ruler",
  description: "Convert between real units of length and Blockbench units",
  version: "1.2.0",
  variant: "both",
  onload() {
    button = new Action("convert_units", {
      name: "Convert Units",
      icon: "fa-ruler",
      description: "Convert between real units of length and Blockbench units",
      click() {
        openConvert()
      }
    })
    MenuBar.addAction(button, "edit")
  },
  onunload() {
      button.delete()
  }
})

/**
 * @typedef {object} ConvertSettings
 * @property {string} value
 * @property {number} rounding
 * @property {number} scale
 */

/**
 * @param {ConvertSettings} settings
 */
function convert(settings) {
  const textValue = settings.value
  const rounding = settings.rounding
  let value
  let factor
  for (const [unit, unitFactor] of UNITS) {
    if (textValue.endsWith(unit)) {
      value = parseFloat(textValue.substring(0, textValue.length - unit.length))
      factor = unitFactor
      break
    }
  }
  if (value === null) {
    throw ArgumentError("Invalid unit")
  }
  if (isNaN(value)) {
    throw ArgumentError("Invalid number")
  }

  return Math.round((value * factor * settings.scale) / rounding) * rounding
}

function openConvert() {
  /** @type {ConvertSettings} */
  let lastSettings = {
    value: "10mm",
    rounding: 0.01,
    scale: 1.0,
    precision: 4,
  }
  try {
    lastSettings = JSON.parse(localStorage.getItem(CONVERT_SETTINGS)) || lastSettings
  } catch (ex) {}
    
  const dialog = new Dialog({
      title: "Convert Units",
      id: "convert_units",
      form: {
        value:     { label: "Value",     type: "text",   value: lastSettings.value      },
        rounding:  { label: "Rounding",  type: "number", value: lastSettings.rounding,  min: 0.0, step: 0.1 },
        scale:     { label: "Scale",     type: "number", value: lastSettings.scale,     min: 0.0, step: 0.1 },
        precision: { label: "Precision", type: "number", value: lastSettings.precision, min: 0,   step: 1 },
      },
      onConfirm(/** @type {ConvertSettings} */ form) {
        dialog.hide()

        try {
          const value = convert(form)
          const textValue = value.toFixed(form.precision)
          navigator.clipboard.writeText(textValue)
          new Dialog({
            title: "Conversion",
            id: "conversion",
            lines: [
              `${form.value} = (copied to clipboard)`
            ],
            form: {
              result: { label: "Result", type: "number", value: textValue, readonly: true }
            },
        }).show()
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

        localStorage.setItem(CONVERT_SETTINGS, JSON.stringify(form))
      }
  })
  dialog.show()
}

})()
