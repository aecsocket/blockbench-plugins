(function () {
  
const MARGIN = 0.0001

/** @type {Action} */
let nudgeAction
/** @type {Action} */
let pinchAction
/** @type {Action} */
let simplifyUvAction
/** @type {Action} */
let unpackAction
/** @type {Action} */
let unpackAllAction
/** @type {Action} */
let denumberGroupsAction

BBPlugin.register("uv_tools", {
  title: "UV Tools",
  icon: "brush",
  author: "aecsocket",
  description: "Tools for manipulating UVs",
  version: "1.3.0",
  min_version: "3.0.5",
  variant: "both",
  onload() {
    nudgeAction = new Action({
      id: "nudge",
      name: "Nudge",
      icon: "fa-hand-point-right",
      click() {
        if (selected.length === 0) {
          Blockbench.showQuickMessage("No cubes selected")
          return
        }

        Undo.initEdit({ elements: Cube.selected })

        Cube.selected.forEach(cube => {
          UVEditor.selected_faces.forEach(face => {
            switch (face) {
              case "down":
                cube.from = [cube.from[0], cube.from[1] + MARGIN, cube.from[2]]
                break
              case "up":
                cube.to = [cube.to[0], cube.to[1] - MARGIN, cube.to[2]]
                break
              case "north":
                cube.from = [cube.from[0], cube.from[1], cube.from[2] + MARGIN]
                break
              case "south":
                cube.to = [cube.to[0], cube.to[1], cube.to[2] - MARGIN]
                break
              case "east":
                cube.to = [cube.to[0] - MARGIN, cube.to[1], cube.to[2]]
                break
              case "west":
                cube.from = [cube.from[0] + MARGIN, cube.from[1], cube.from[2]]
                break
            }
            Canvas.adaptObjectPosition(cube)
            Canvas.updateUV(cube)
          })
        })

        Undo.finishEdit("Nudge")
      }
    })
    pinchAction = new Action({
      id: "pinch",
      name: "Pinch",
      icon: "fa-hand-lizard",
      click() {
        if (selected.length === 0) {
          Blockbench.showQuickMessage("No cubes selected")
          return
        }

        Undo.initEdit({ elements: Cube.selected })

        Cube.selected.forEach(cube => {
          UVEditor.selected_faces.forEach(face => {
            switch (face) {
              case "down":
              case "up":
                cube.from = [cube.from[0], cube.from[1] + MARGIN, cube.from[2]]
                cube.to = [cube.to[0], cube.to[1] - MARGIN, cube.to[2]]
                break
              case "north":
              case "south":
                cube.from = [cube.from[0], cube.from[1], cube.from[2] + MARGIN]
                cube.to = [cube.to[0], cube.to[1], cube.to[2] - MARGIN]
                break
              case "east":
              case "west":
                cube.to = [cube.to[0] - MARGIN, cube.to[1], cube.to[2]]
                cube.from = [cube.from[0] + MARGIN, cube.from[1], cube.from[2]]
                break
            }
            Canvas.adaptObjectPosition(cube)
            Canvas.updateUV(cube)
          })
        })

        Undo.finishEdit("Pinch")
      }
    })
    simplifyUvAction = new Action({
      id: "simplify_uv",
      name: "Simplify UV",
      icon: "compress",
      click() {
        if (selected.length === 0) {
          Blockbench.showQuickMessage("No cubes selected")
          return
        }

        Undo.initEdit({ elements: Cube.selected, uv_only: true })

        Cube.selected.forEach(cube => {
          for (const face in cube.faces) {
            if (cube.faces.hasOwnProperty(face) && cube.faces[face].texture !== null) {
              let uv = cube.faces[face].uv
              let delta = [uv[2] - uv[0], uv[3] - uv[1]].map(x => Math.ceil(Math.max(0.000001, x)))
              let from = [uv[0], uv[1]].map(x => Math.ceil(x))
              cube.faces[face].uv = [from[0], from[1], from[0] + delta[0], from[1] + delta[1]]
            }
          }
          Canvas.updateUV(cube)
        })
        UVEditor.loadData()

        Undo.finishEdit("Simplify UV")
      }
    })
    unpackAction = new Action({
      id: "unpack",
      name: "Unpack",
      icon: "fa-box-open",
      click() {
        if (!Group.selected) {
          Blockbench.showMessageBox({
            title: "Error",
            message: "You must select the group to unpack!",
          })
          return
        }

        Undo.initEdit({ group: Group.selected })

        Group.selected.resolve()

        Undo.finishEdit("Unpack")
      }
    }),
    unpackAllAction = new Action({
      id: "unpack-all",
      name: "Unpack All",
      icon: "fa-box-open",
      click() {
        if (!Group.selected) {
          Blockbench.showMessageBox({
            title: "Error",
            message: "You must select the group to unpack!",
          })
          return
        }

        Undo.initEdit({ group: Group.selected })

        let allGroups = []
        const getAllGroups = elem => {
          if (elem.children === undefined) {
            // not a group
            return
          }

          allGroups.push(elem)
          elem.children.forEach(getAllGroups)
        }
        getAllGroups(Group.selected)

        allGroups.forEach(group => group.resolve())

        Undo.finishEdit("Unpack all")
      },
    }),
    denumberGroupsAction = new Action({
      id: "denumber_groups",
      name: "Denumber Groups",
      icon: "fa-eraser",
      click() {
        Undo.initEdit({ outliner: true })
        
        const denumber = elem => {
          if (elem.children === undefined) {
            // not a group
            return
          }
          
          const name = elem.name
          let newEnd = name.length
          for (let i = newEnd - 1; i >= 0; i--) {
            const char = name.charAt(i)
            if (char >= "0" && char <= "9") {
              newEnd--
            } else {
              // no more chars to denumber
              break
            }
          }
          if (newEnd > 0) {
            // we don't denumber group names which only consist of numbers
            elem.name = name.slice(0, newEnd) 
          }

          elem.children.forEach(denumber)
        }

        Outliner.root.forEach(denumber)
        Undo.finishEdit("Denumber groups")
      }
    })
    MenuBar.addAction(nudgeAction, "filter")
    MenuBar.addAction(pinchAction, "filter")
    MenuBar.addAction(simplifyUvAction, "filter")
    MenuBar.addAction(unpackAction, "filter")
    MenuBar.addAction(unpackAllAction, "filter")
    MenuBar.addAction(denumberGroupsAction, "filter")
  },
  onunload() {
    nudgeAction.delete()
    pinchAction.delete()
    simplifyUvAction.delete()
    unpackAction.delete()
    unpackAllAction.delete()
    denumberGroupsAction.delete()
  }
})

})()
