(function() {

let button

Plugin.register("units", {
    title: "Units",
    author: "aecsocket",
    icon: "fa-ruler",
    description: "Convert between real units of length and Blockbench units",
    version: "1.1",
    variant: "both",
    onload() {
        button = new Action("convert_units", {
            name: "Convert Units",
            description: "Convert between real units of length and Blockbench units",
            icon: "fa-ruler",
            click: function() {
                openConversionWindow()
            }
        })
        MenuBar.addAction(button, "edit")
    },
    onunload() {
        button.delete()
    }
})

function openConversionWindow() {
    const units = {
        cm: (1 / 100) * 16,
        mm: (1 / 1000) * 16,
        m: 16,
        in: 0.0254 * 16,
    }

    function show(obj) {
        obj.show()
        if (localStorage.getItem("convert_units_value") != undefined) {
            $(".dialog#convert_units input#value").val(localStorage.getItem("convert_units_value"))
            $(".dialog#convert_units input#rounding").val(localStorage.getItem("convert_units_rounding"))
            $(".dialog#convert_units input#scale").val(localStorage.getItem("convert_units_scale"))
        }
    }

    const dialog = new Dialog({
        title: "Convert Units",
        id: "convert_units",
        form: {
            value: {label: "Value", type: "text", value: "10mm"},
            rounding: {label: "Rounding", type: "number", value: 0.01},
            scale: {label: "Scale", type: "number", value: 1.0}
        },
        draggable: true,
        onConfirm(result) {
            const rawValue = result.value
            var value = null
            for (const [ending, thisFactor] of Object.entries(units)) {
                if (rawValue.endsWith(ending)) {
                    value = {
                        amount: rawValue.substring(0, rawValue.length - ending.length),
                        unit: ending,
                        factor: thisFactor,
                    }
                    break
                }
            }
            if (value === null) {
                new Dialog({
                    title: "Conversion",
                    id: "conversion",
                    lines: [
                        `Invalid unit on '${rawValue}'`
                    ],
                    onConfirm() {
                        show(dialog)
                    }
                }).show()
                return
            }
            var amount = parseFloat(value.amount)
            if (isNaN(amount)) {
                new Dialog({
                    title: "Conversion",
                    id: "conversion",
                    lines: [
                        `Not a number: '${rawValue}'`
                    ],
                    onConfirm() {
                        show(dialog)
                    }
                }).show()
                return
            }
            var rounding = result.rounding
            var scale = result.scale
            localStorage.setItem("convert_units_value", rawValue)
            localStorage.setItem("convert_units_rounding", rounding)
            localStorage.setItem("convert_units_scale", scale)
            dialog.hide()

            var bbValue = Math.round((amount * value.factor * scale) / rounding) * rounding
            navigator.clipboard.writeText(bbValue)
            new Dialog({
                title: "Conversion",
                id: "conversion",

                form: {
                    result: {label: "Result", type: "number", value: bbValue}
                },
                lines: [
                    `${amount} ${value.unit} = (copied to clipboard)`
                ],
            }).show()
        }
    })
    show(dialog)
}

})()
