var https = require('https');
var util = require('util');

/**
 * SNS Event object.
 * @typedef {Object} SnsEvent
 * @property {Array.<SnsRecord>} Records
 */

/**
 * Handler callback
 * @callback HandlerCallback
 * @param {Error} error
 * @param {Object} [result]
 */

/**
 * SNS Record object.
 * @typedef {Object} SnsRecord
 * @property {String} EventSource
 * @property {String} EventVersion
 * @property {String} EventSubscriptionArn
 * @property {SnsObject} Sns
 */

/**
 * SNS object.
 * @typedef {Object} SnsObject
 * @property {String} MessageId
 * @property {String} TopicArn
 * @property {String|null} Subject
 * @property {String} Message
 * @property {String} Timestamp
 * @property {String} SignatureVersion
 * @property {String} Signature
 * @property {String} SigningCertUrl
 * @property {String} UnsubscribeUrl
 * @property {Object} MessageAttributes
 */

/**
 * Message object.
 * @typedef {Object} MessageObject
 * @property {string} type
 * @property {string} [pipeline]
 * @property {string} [project]
 * @property {string} [channel]
 * @property {string} [state]
 * @property {string} [link]
 * @property {string} [stream]
 * @property {string} [group]
 * @property {Object} [approval]
 * @property {string} [approval.pipelineName]
 * @property {string} [approval.approvalReviewLink]
 * @property {string} [AlarmName]
 * @property {string} [AlarmDescription]
 * @property {Object[]} [Records]
 */

/**
 * Data object.
 * @typedef {Object} DataObject
 * @property {string} channel
 * @property {string} username
 * @property {string} text
 * @property {Attachment[]} attachments
 */

/**
 * Attachment
 * @typedef {Object} Attachment
 * @property {string} color
 * @property {string} text
 */

/**
 * Approval custom data
 * @typedef {Object} ApprovalData
 * @property {string} channel
 * @property {boolean} isProd
 */

/**
 * Safe JSON parser
 * @param {string} json
 * @param {HandlerCallback} cb
 * @returns {MessageObject}
 */
function parseJson(json, cb) {
    'use strict';
    var parsed;

    try {
        parsed = JSON.parse(json);
    } catch (e) {
        cb(e);
    }

    return parsed;
}

/**
 *
 * @param {string} state
 * @returns {string}
 */
function getColour(state) {
    'use strict';
    switch(state) {
        case "FAILED":
        case "STOPPED":
            return "danger";

        case "CANCELED":
        case "ALERT":
            return "warning";

        case "STARTED":
        case "RESUMED":
        case "INFO":
            return "#1a45f2";

        default:
            break;
    }

    return "good";
}

/**
 * Create message object
 * @param {string} message
 * @param {HandlerCallback} cb
 * @returns {MessageObject}
 */
function createMessageObject(message, cb) {
    'use strict';
    /**
     * Message Object
     * @type {MessageObject}
     */
    var msgObj = parseJson(message, cb),
        /**
         * Type
         * @type {string}
         */
        type = "UNKNOWN";

    if (msgObj.hasOwnProperty("AlarmName")) {
        type = "ALARM";
    }
    else if (msgObj.hasOwnProperty("approval")) {
        msgObj.approval.customData = parseJson(msgObj.approval.customData, cb);
        type = "APPROVAL";
    }

    else if (msgObj.hasOwnProperty("project")) {
        type = "PROJECT";
    }

    else if (msgObj.hasOwnProperty("pipeline")) {
        type = "PIPELINE";
    }

    else if (msgObj.hasOwnProperty("Records") && msgObj.Records[0].hasOwnProperty("codecommit")) {
        type = "CODECOMMIT";
    }

    console.log('Type: ', type);

    msgObj.type = type;

    return msgObj;
}

/**
 * Data payload constructor
 * @param {MessageObject} msgObj
 * @param {DataObject} data
 */
function setData(msgObj, data) {
    'use strict';
    switch (msgObj.type)
    {
        case "ALARM":
            data.channel = "alarms";
            data.text = "ALERT! - " + msgObj.AlarmName;
            break;

        case "APPROVAL":
            data.channel = msgObj.approval.customData.channel;
            data.text = "APPROVAL NEEDED: " + msgObj.approval.pipelineName;
            break;

        case "PROJECT":
            data.channel = msgObj.channel;
            data.text = "PROJECT: " + msgObj.project;
            break;

        case "PIPELINE":
            data.channel = msgObj.channel;
            data.text = "PIPELINE: " + msgObj.pipeline;
            break;

        case "CODECOMMIT":

            break;

        default:

    }

    data.text = util.format("*%s*", data.text);



        // for(var i in msgObj.detail['additional-information'].phases) {
        //     var phase = msgObj.detail['additional-information'].phases[i]
        //     if(phase['phase-status'] == "FAILED") {
        //         message += "\n" + phase['phase-type'] + " phase failed: " + phase['phase-context'].toString();
        //     }
        // }
}

/**
 *
 * @param {MessageObject} msgObj
 * @param {DataObject} data
 */
function addAttachments(msgObj, data) {
    'use strict';
    switch (msgObj.type)
    {
        case "ALARM":
            data.attachments = [
                {
                    "color": getColour("ALERT"),
                    "text": msgObj.AlarmDescription
                }
            ];
            break;

        case "APPROVAL":
            data.attachments = [
                {
                    "color": getColour(msgObj.approval.customData.isProd ? "ALERT" : "INFO"),
                    "pretext": msgObj.approval.customData.isProd ? "Ready for Production" : "QA finished",
                    "fields": [
                        {
                            "title": msgObj.approval.customData.isProd ? "This will update production!" : "No changes will be made.",
                            "value": util.format("<%s|Click to Approve>", msgObj.approval.approvalReviewLink)
                        }
                    ]
                }
            ];
            break;

        case "PROJECT":
            data.attachments = [
                {
                    "color": getColour(msgObj.state),
                    "pretext": "Pipeline build has " + msgObj.state.toLowerCase(),
                    "fields": [
                        {
                            "title": "Log URL",
                            "value": util.format("<%s|Click to View>", msgObj.link)
                        },
                        {
                            "title": "CLI command",
                            "value": util.format("aws --query events[*].message --output text logs filter-log-events --log-group-name %s --log-stream-names %s", msgObj.group, msgObj.stream),
                            "short": false
                        }
                    ]
                }
            ];
            break;

        case "PIPELINE":
            if(msgObj.state === "SUCCEEDED")
            {
                data.attachments = [
                    {
                        "color": getColour(msgObj.state),
                        "text": "Pipeline has completed successfully."
                    }
                ];
            }
            else
            {
                data.attachments = [
                    {
                        "color": getColour(msgObj.state),
                        "pretext": "Pipeline has " + msgObj.state.toLowerCase(),
                        "fields": [
                            {
                                "title": "Pipeline",
                                "value": util.format("<%s|Click to View>", "https://console.aws.amazon.com/codepipeline/home?region=eu-west-1#/view/" + msgObj.pipeline)
                            }
                        ]
                    }
                ];
            }
            break;

        // case "CODECOMMIT":
        //
        //     break;

        default:
            data.attachments = [
                {
                    "color": getColour("INFO"),
                    "text": util.format("%j", msgObj)
                }
            ];
    }
}

/**
 * Main
 * @param {SnsEvent} event
 * @param {Object} context
 * @param {HandlerCallback} callback
 */
exports.handler = function(event, context, callback) {
    'use strict';
    console.log(JSON.stringify(event, null, 2));
    console.log('From SNS: ', event.Records[0].Sns.Message);

    /**
     * Request Options
     * @type {{}}
     */
    var options = {
            method: 'POST',
            hostname: process.env.SlackHost,
            port: 443,
            path: process.env.SlackPath
        },

        /**
         * postData
         * @type {DataObject}
         */
        postData = {
            channel: "scoreboard-sns",
            username: "AWS SNS via Lambda :: Ops",
            text: event.Records[0].Sns.Subject,
            attachments: []
        },

        /**
         * Request
         * @type {*}
         */
        req = https.request(options, function(res) {
            console.log('StatusCode', res.statusCode);
            console.log('Headers', res.headers);
            res.setEncoding('utf8');
            res.on('data', function (d) {
                console.log(d);
                callback(null, "Data Success");
            });
            res.on('end', function () {
                callback(null, "End Success");
            });
        }),

        /**
         * Message Object
         * @type {MessageObject}
         */
        msgObj = createMessageObject(event.Records[0].Sns.Message, callback);

    /**
     *
     */
    req.on('error', function(e) {
        console.log('problem with request: ' + e.message);
        callback(e);
    });

    setData(msgObj, postData);
    addAttachments(msgObj, postData);

    req.write(util.format("%j", postData));
    req.end();
};
