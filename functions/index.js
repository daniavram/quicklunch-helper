'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.postOrder = functions.https.onRequest((request, response) => {
  var user = request.body.user
  var rawOrder = request.body.order
  // strip whitespaces
  rawOrder = rawOrder.replace(/\s+/g, '')
  // format user's string in an object like { "day": ["string", "of", "order_letters"] }
  var regex = /(\w+(\+\w+)*)/gi
  var dayOrders = rawOrder.match(regex)
  dayOrders = dayOrders.map(element =>
    element.toUpperCase().split('+').sort()
  )

  // this value for `nothing` was chosen because `_` is a regex friendly value
  // for var regex defined above
  let nothing = ["_"]
  var initialDays = {
    "monday": dayOrders[0] || nothing,
    "tuesday": dayOrders[1] || nothing,
    "wednesday": dayOrders[2] || nothing,
    "thursday": dayOrders[3] || nothing,
    "friday": dayOrders[4] || nothing
  }

  // construct the db object without undefined values for days names
  var weekOrder = {}
  if (initialDays.monday.toString() !== nothing.toString()) { weekOrder.monday = initialDays.monday }
  if (initialDays.tuesday.toString() !== nothing.toString()) { weekOrder.tuesday = initialDays.tuesday }
  if (initialDays.wednesday.toString() !== nothing.toString()) { weekOrder.wednesday = initialDays.wednesday }
  if (initialDays.thursday.toString() !== nothing.toString()) { weekOrder.thursday = initialDays.thursday }
  if (initialDays.friday.toString() !== nothing.toString()) { weekOrder.friday = initialDays.friday }

  admin.database().ref('weeklyMenu/days').once('value', (snapshot) => {
    var days = snapshot.val();
    var userOrder = {}
    userOrder["days"] = {}
    var prices = []

    Object.keys(weekOrder).forEach(dayName => {
      var menus = weekOrder[dayName]

      var ordersForDay = []
      menus.forEach(menuName => {
        var dayMenu = days[dayName][menuName]
        if (!dayMenu) { return }

        ordersForDay.push(dayMenu)
        prices.push(dayMenu.course.price)
      })

      if (ordersForDay.length > 0) {
        userOrder["days"][dayName] = ordersForDay
      }
    })

    var flattenedPrices = [].concat.apply([], prices)
    flattenedPrices = flattenedPrices.map(price => parseFloat(price))
    var price = flattenedPrices.reduce((a, b) => a + b, 0);

    userOrder["total"] = price

    var weekNumber = getWeekNumber(new Date())
    var ordersInDb = admin.database().ref('orders/' + weekNumber + '/' + user)
    ordersInDb.set(userOrder)

    response.send(userOrder)
  });
});

exports.deleteLatestOrders = functions.https.onRequest((request, response) => {
  if (request.method !== "DELETE") {
    response.send("Are you sure you know what you're doing?")
    return
  }

  var weekNumber = getWeekNumber(new Date())
  var ordersInDb = admin.database().ref('orders/' + weekNumber)
  ordersInDb.set({})

  response.send("Orders deleted")
});

exports.deleteUserOrder = functions.https.onRequest((request, response) => {
  if (request.method !== "DELETE") {
    response.send("Are you sure you know what you're doing?")
    return
  }

  var user = request.query.user
  if (!user) {
    response.send("User not specified")
    return
  }

  var weekNumber = getWeekNumber(new Date())
  var ordersInDb = admin.database().ref('orders/' + weekNumber + '/' + user)
  ordersInDb.set({})

  response.send("Order deleted for " + user)
});

exports.getUserOrders = functions.https.onRequest((request, response) => {
  if (request.method !== "GET") {
    response.send("Are you sure you know what you're doing?")
    return
  }

  var user = request.query.user
  if (!user) {
    response.send("User not specified")
    return
  }

  var weekNumber = getWeekNumber(new Date())
  admin.database().ref('orders/' + weekNumber + '/' + user).once('value', (snapshot) => {
    var userOrder = snapshot.val()
    var days = userOrder.days
    if (!userOrder || !days) {
      response.send(user + " has no orders")
      return
    }

    var filteredOrders = {}
    Object.keys(days).forEach(dayName => {
      var allOrdersForDay = days[dayName].map(day => {
        return {
          "menu": day.menu.title,
          "dish": day.course.name,
          "price": day.course.price
        }
      })

      filteredOrders[dayName] = allOrdersForDay
    })

    var responseObject = {
      "total": userOrder.total,
      "days": filteredOrders
    }

    response.send(responseObject)
  })
});

exports.getUserTotal = functions.https.onRequest((request, response) => {
  if (request.method !== "GET") {
    response.send("Are you sure you know what you're doing?")
    return
  }

  var user = request.query.user
  if (!user) {
    response.send("User not specified")
    return
  }

  var weekNumber = getWeekNumber(new Date())
  admin.database().ref('orders/' + weekNumber + '/' + user + '/total').once('value', (snapshot) => {
    var price = snapshot.val()
    response.send({"total": price})
  })
});

exports.getUserToday = functions.https.onRequest((request, response) => {
  if (request.method !== "GET") {
    response.send("Are you sure you know what you're doing?")
    return
  }

  var user = request.query.user
  if (!user) {
    response.send("User not specified")
    return
  }

  var date = new Date()
  var dayIndex = date.getDay()
  var days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]

  var dayName = days[dayIndex]

  var weekNumber = getWeekNumber(new Date())
  admin.database().ref('orders/' + weekNumber + '/' + user + '/days/' + dayName).once('value', (snapshot) => {
    var userOrderForDay = snapshot.val()
    if (!userOrderForDay) {
      response.send(user + " has no order for " + dayName)
      return
    }

    var allOrdersForDay = userOrderForDay.map(day => {
      return {
        "menu": day.menu.title,
        "dish": day.course.name
      }
    })

    var todayOrder = {}
    todayOrder[dayName] = allOrdersForDay

    response.send(todayOrder)
  })
});

exports.getLatestOrdersTotal = functions.https.onRequest((request, response) => {
  if (request.method !== "GET") {
    response.send("Are you sure you know what you're doing?")
    return
  }

  var weekNumber = getWeekNumber(new Date())
  admin.database().ref('orders/' + weekNumber).once('value', (snapshot) => {
    var orders = snapshot.val()
    if (!orders) {
      response.send("No orders")
      return
    }

    var totals = 0
    Object.keys(orders).forEach(user => {
      var userTotal = orders[user]["total"]
      if (userTotal) {
          totals = totals + userTotal
      }
    })

    var responseObject = { "totals": totals }
    response.send(responseObject)
  })
});

exports.getLatestOrders = functions.https.onRequest((request, response) => {
  if (request.method !== "GET") {
    response.send("Are you sure you know what you're doing?")
    return
  }

  var weekNumber = getWeekNumber(new Date())
  admin.database().ref('orders/' + weekNumber).once('value', (snapshot) => {
    var orders = snapshot.val()
    if (!orders) {
      response.send("No orders")
      return
    }

    var responseObject = {}
    Object.keys(orders).forEach(user => {
      var userObject = orders[user]["days"]
      Object.keys(userObject).forEach(daysKey => {
        var day = userObject[daysKey]
        if (!day) { return }

        var userOrders = day.map(dayOrder => { return dayOrder.menu.title })

        if (!responseObject[daysKey]) {
          responseObject[daysKey] = userOrders
        } else {
          responseObject[daysKey] = responseObject[daysKey].concat(userOrders)
        }

        responseObject[daysKey] = responseObject[daysKey].sort()
      })
    })

    var nonDuplicates = {}
    Object.keys(responseObject).forEach(orderForDay => {
      var menus = responseObject[orderForDay]
      var count = {};
      menus.forEach(index => { count[index] = (count[index] || 0) + 1})

      nonDuplicates[orderForDay] = count
    })

    response.send(nonDuplicates)
  })
});

function getWeekNumber(d) {
    // Copy date so don't modify original
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    // Set to nearest Thursday: current date + 4 - current day number
    // Make Sunday's day number 7
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    // Get first day of year
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    // Calculate full weeks to nearest Thursday
    var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    // Return array of year and week number
    return String(d.getUTCFullYear()) + '-' + weekNo;
}
