//Add in your database secret
var secret = '8ffiUTd055WtCleVGMplZLHNgzA6Ska8oVPlkXfo'

function getFirebaseUrl(jsonPath) {
  /*
  We then make a URL builder
  This takes in a path, and
  returns a URL that updates the data in that path
  */
  return (
    'https://quicklunch-scraper.firebaseio.com/' +
    jsonPath +
    '.json?auth=' +
    secret
  )
}

function syncMasterSheet(excelData) {
  /*
  We make a PUT (update) request,
  and send a JSON payload
  More info on the REST API here : https://firebase.google.com/docs/database/rest/start
  */

  var options = {
    method: 'put',
    contentType: 'application/json',
    payload: JSON.stringify(excelData)
  }
  var fireBaseUrl = getFirebaseUrl('weeklyMenu')

  /*
  We use the UrlFetchApp google scripts module
  More info on this here : https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app
  */
  UrlFetchApp.fetch(fireBaseUrl, options)
}

function getValuesFrom(sheet, column) {
  var rows = sheet.getLastRow() - 1
  var valuesColumn = sheet.getRange(2, column, rows, 1).getValues()
  var menuTitlesColumn = sheet.getRange(2, 2, rows, 1).getValues()

  var valuesArray = {}

  for (index=0; index < valuesColumn.length; index++) {
    var menuTitleValue = menuTitlesColumn[index].toString()
    var menuTitleValueRegex = new RegExp("(.*?)\n(.*)", "gi")
    var titleMatches = menuTitleValueRegex.exec(menuTitleValue)
    var menuTitle = titleMatches[1]
    var menuSubtitle = titleMatches[2]
    menuSubtitle = menuSubtitle.replace(/- /gi, '')

    var menuIdentifier = menuTitle + " " + menuSubtitle
    menuIdentifier = menuIdentifier.replace(/ /gi, '-')

    var menuValue = valuesColumn[index][0].toString()
    var menuValueRegex = new RegExp("(.*?)\\s+(\\d+[\\.,]\\d+)", "gi")
    var valueMatches = menuValueRegex.exec(menuValue)

    var courseName = ""
    var coursePrice = ""

    if (valueMatches) {
      courseName = valueMatches[1]
      coursePrice = valueMatches[2]
    }

    var course = {
      name: courseName,
      price: coursePrice
    }

    var menu = {
      id: menuIdentifier,
      title: menuTitle,
      subtitle: menuSubtitle
    }

    var dayMenu = {
      menu: menu,
      course: course
    }

    // TODO: This is the mobile friendly version
    // better for client to display data
    //valuesArray[index] = dayMenu
    // This is the Postman friendly version
    valuesArray[menuTitle] = dayMenu
  }

  return valuesArray
}

function startSync() {
  //Get the currently active sheet
  var sheet = SpreadsheetApp.getActiveSheet()

  var weekNumber = sheet.getRange(1, 1, 1, 1).getCell(1, 1).getValue()

  var days = {
    monday: getValuesFrom(sheet, 3),
    tuesday: getValuesFrom(sheet, 4),
    wednesday: getValuesFrom(sheet, 5),
    thursday: getValuesFrom(sheet, 6),
    friday: getValuesFrom(sheet, 7)
  }

  var menu = {
    weekNumber: weekNumber,
    days: days
  }

  //Use the syncMasterSheet function defined before to push this data to the "masterSheet" key in the firebase database
  syncMasterSheet(menu)
}
