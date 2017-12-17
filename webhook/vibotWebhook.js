// Copyright 2017, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';
const _ = require('lodash');
const http = require('http');
const MongoClient = require('mongodb').MongoClient;
const URL = 'mongodb://root:123@ds157682.mlab.com/57682/alexa';


let vibotWebhook = function(req, res) {
  console.log("REQ: ", JSON.stringify(req.body, null, '\t'));
  let intentName = req.body.result.metadata.intentName;
  let date = new Date().toJSON().slice(0, 10);
  if (intentName == "zaloIntents") {
    var itemName = req.body.result.parameters.product;
    var itemColor = req.body.result.parameters.colorVN;
    var itemNew = req.body.result.parameters.product_new_status;

    console.log(itemName + itemColor + itemNew);

    selectData(itemName, itemColor, itemNew).then(results => {
      console.log("data: ", JSON.stringify(results, null, '\t'));
      let postback = req.body.originalRequest.data.postback;
      if (typeof postback == "undefined") {

        var elements = [];

        let prefixUrl = "https://storage.googleapis.com/zalo-189015-img-db/resources/";

        for (let i = 0; i < results.length; i++) {
          var base_elem = {
            "title": "Red T-Shirt (#1)",
            "image_url": "https://cdn.shopify.com/s/files/1/1320/3823/products/antique_cherry_71ce0607-2833-48b7-b2c0-6600391ed56b_800x.jpg?v=1475015893",
            "subtitle": "Miễn phí",
            "default_action": {
              "type": "web_url",
              "url": "https://www.facebook.com/TMAChatbot/?hc_ref=ARSaY6voPtAXULt1Vf9Mkv1UHXRaWrvQ47P9y7QY66Qm1PHQ7291uydj7uLFqrApfLA&fref=nf",
              "webview_height_ratio": "tall"
            },
            "buttons": [{
                "title": "Chi tiết cấu hình",
                "type": "postback",
                "webview_height_ratio": "tall",
                "payload": 123
              },
              {
                "title": "Xem đánh giá",
                "type": "postback",
                "payload": 123
              }
            ]
          };
          var elem = results[i];
          var subtitle = "Mã sản phẩm: " + elem['_id'] + ".\n" +
            "Giá: " + elem.price + ".\n" +
            "Khuyến mãi: " + JSON.stringify(elem.fullSaleInfo.promo.join())

          var merged = _.merge(base_elem, {
            "title": elem.name,
            "image_url": prefixUrl + elem.imgUrl,
            "subtitle": subtitle,
            "default_action": {
              "url": prefixUrl + elem.imgUrl
            },
            "buttons": [{
                "payload": elem['_id']
              },
              {
                "payload": elem['_id']
              }
            ]
          });
          console.log(JSON.stringify(elements));
          elements.push(merged);
          merged = {};
          subtitle = "";
        }

        console.log("elements: " + JSON.stringify(elements));

        var payload = {
          "facebook": {
            "attachment": {
              "type": "template",
              "payload": {
                "template_type": "generic",
              }
            }
          }
        };


        payload.facebook.attachment.payload.elements = elements;
        console.log("PAYLOAD:" + JSON.stringify(payload));
        // Return the results of the weather API to API.AI
        res.setHeader('Content-Type', 'application/json');
        // res.send(output);
        res.send(JSON.stringify({
          'speech': '',
          'messages': [{
              'type': 4,
              'platform': 'facebook',
              'payload': payload
            },
            {
              'type': 0,
              'speech': ''
            }
          ]
        }));

      }

    });

  } else if (intentName == "rate_me") {
    var score = parseInt(req.body.originalRequest.data.message.text);

    console.log("SCORE: " + score);
    ratingProcessor(score)
      .then(avg => {
        console.log("avg: " + avg);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({
          'speech': 'Hiện tôi được đánh giá là: ' + avg + "/5*",
          'displayText': 'Hiện tôi được đánh giá là: ' + avg + "/5*"
        }));
      })
      .catch(e => {
        throw e
      })
  } else if (intentName == "Default Fallback Intent") {
    if (req.body.originalRequest.data.postback) {
      // res.setHeader('Content-Type', 'application/json');
      // res.send(JSON.stringify({
      //   'speech': req.body.originalRequest.data.postback.title +'_'+ req.body.originalRequest.data.postback.payload,
      //   'displayText':  req.body.originalRequest.data.postback.title +'_'+ req.body.originalRequest.data.postback.payload
      // }));
      var comment = "";
      if (req.body.originalRequest.data.postback.title == "Xem đánh giá") {
        selectById(Number(req.body.originalRequest.data.postback.payload))
          .then(record => {
            record.fullSaleInfo.listCmts.forEach(e => {
              comment += e.name + ": " + e.cmt + "\n";

              res.setHeader('Content-Type', 'application/json');
              res.send(JSON.stringify({
                'speech': 'Bình luận:\n' + comment,
                'displayText': 'Bình luận:\n' + comment
              }));
            })
          })
          .catch(error => res.status(500).send('Something wrong\n' + error));
      } else if (req.body.originalRequest.data.postback.title == "Chi tiết cấu hình") {
        selectById(Number(req.body.originalRequest.data.postback.payload))
          .then(record => {
            let fullTechInfo = record.fullTechInfo
            if (!fullTechInfo) return []

            let elements = Object.keys(fullTechInfo).map(key => {
              let elem = fullTechInfo[key]
              let subItem = Object.keys(elem)
              let a = subItem.map(elemKey => {
                return elemKey + ': ' + elem[elemKey]
              })

              return {
                title: key,
                subtitle: a.join('\n')
              }
            })

            var payload = {
              "facebook": {
                "attachment": {
                  "type": "template",
                  "payload": {
                    "template_type": "generic",
                    "top_element_style": "LARGE",
                    "elements": elements
                  }
                }
              }
            };

            console.log("Payload return: " + payload);

            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({
              'speech': '',
              'messages': [{
                  'type': 4,
                  'platform': 'facebook',
                  'payload': payload
                },
                {
                  'type': 0,
                  'speech': ''
                }
              ]
            }));
          })
      }
    }
  }
}


let selectData = function(itemName, itemColor, itemNew,
  URI = 'mongodb://reader:123@ds157682.mlab.com:57682/alexa', DB = 'alexa', COLLECTION = 'zdb') {
  return new Promise((res, rej) => {
    MongoClient.connect(URI).then(con => {
      let collection = con.db(DB).collection(COLLECTION);
      let findQuerry = {
        $text: {
          $search: itemName
        }
      };

      if (itemColor && itemColor !== 'any') {
        findQuerry.colors = {
          $in: [itemColor]
        };
      }
      if (itemNew) {
        if (itemNew == "cũ") {
          findQuerry['new'] = {
            $exists: false
          }
        } else {
          findQuerry['new'] = {
            $exists: true
          }
          console.log(findQuerry)
        }
      }

      console.log(findQuerry);

      try {
        var resultData = collection
          .find(findQuerry, {
            score: {
              $meta: "textScore"
            }
          })
          .sort({
            score: {
              $meta: 'textScore'
            }
          }).limit(5).toArray()
          .then(r => {
            console.log(r);
            res(r)
            con.close()
          }).catch(e => {
            rej(e)
            con.close()
          })
      } catch (e) {
        console.log(e)
        rej(e)
        con.close()
      }
      // con.close()
    }).catch(rej)
  })
}

function ratingProcessor(score) {
  const
    _URI = 'mongodb://modifier:123@ds157682.mlab.com:57682/alexa',
    _DB = 'alexa',
    _CO = 'zuserrating';
  score = Number(score);
  return new Promise((resolve, reject) => {
    MongoClient.connect(_URI).then(connection => {
      if (!score) {
        reject('Unknown score');
        return
      }

      let col = connection.db(_DB).collection(_CO)
      col.findOne({
          _id: 0
        })
        .then(r => {
          if (r && r.scoreArray) r.scoreArray[score] += 1
          else {
            let tmp = []
            tmp[score] = 1
            r = {
              _id: 0,
              scoreArray: tmp
            }
          }

          let
            total = r.scoreArray.reduce((a, b) => a + b, 0),
            avg = r.scoreArray.reduce((a, b, c) => a + b * c) / total;

          resolve(avg);

          // then write back to db
          col.findOneAndReplace({
            _id: 0
          }, r, {
            upsert: true
          }).then(() => connection.close())
        }).catch(e => {
          reject(e)
          connection.close()
        })
    }).catch(reject)
  })
}

function selectById(idToFind) {
  const
    _URI = 'mongodb://reader:123@ds157682.mlab.com:57682/alexa',
    _DB = 'alexa',
    _CO = 'zdb';
  return new Promise((resolve, reject) => {
    MongoClient.connect(_URI).then(connection => {
      if (!idToFind) {
        reject('Unknown score');
        return
      }

      let Resolved = (reason) => {
        connection.close();
        resolve(reason)
      }
      let Rejected = (reason) => {
        connection.close();
        reject(reason)
      }

      let col = connection.db(_DB).collection(_CO)
      col.findOne({
          _id: idToFind
        })
        .then(Resolved)
        .catch(Rejected)
      connection.close()
    }).catch(reject)
  })
}

module.exports.vibotWebhook = vibotWebhook;
