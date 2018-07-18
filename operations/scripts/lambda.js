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
 * @property {string} [command]
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
 * Main
 * @param {SnsEvent} event
 * @param {Object} context
 * @param {HandlerCallback} callback
 */
exports.handler = function(event, context, callback) {
    console.log(JSON.stringify(event, null, 2));
    console.log('From SNS: ', event.Records[0].Sns.Message);

    /**
     * Request Options
     * @type {{}}
     */
    var options = {
        method: 'POST',
        hostname: 'hooks.slack.com',
        port: 443,
        path: '/services/${SlackEndpoint}'
    };

    /**
     * postData
     * @type {DataObject}
     */
    var postData = {
        "channel": "scoreboard-sns",
        "username": "AWS SNS via Lambda :: Ops",
        "text": event.Records[0].Sns.Subject
    };

    /**
     * Message Object
     * @type {MessageObject}
     */
    var msgObj = createMessageObject(event.Records[0].Sns.Message, callback);

    setData(msgObj, postData);
    addAttachments(msgObj, postData);

    createRequest(options, postData, callback);
};

/**
 * Safe JSON parser
 * @param {string} json
 * @param {HandlerCallback} cb
 * @returns {MessageObject}
 */
function parseJson (json, cb) {
    var parsed;

    try {
        parsed = JSON.parse(json);
    } catch (e) {
        cb(e);
    }

    return parsed
}

/**
 * Request maker
 * @param {Object} options
 * @param {DataObject} data
 * @param {HandlerCallback} cb
 */
function createRequest(options, data, cb)
{
    var req = https.request(options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            cb(null, "Success");
        });
    });

    req.on('error', function(e) {
        console.log('problem with request: ' + e.message);
        cb(e);
    });

    req.write(util.format("%j", data));
    req.end();
}

/**
 * Create message object
 * @param {string} message
 * @param {HandlerCallback} cb
 * @returns {MessageObject}
 */
function createMessageObject(message, cb)
{
    /**
     * Message Object
     * @type {MessageObject}
     */
    var msgObj = parseJson(message, cb);
    var type = "UNKNOWN";

    if( msgObj.hasOwnProperty("AlarmName") ) {
        type = "ALARM";
    }
    else if( msgObj.hasOwnProperty("approval") ) {
        msgObj.approval.customData = parseJson(msgObj.approval.customData, cb);
        type = "APPROVAL";
    }

    else if( msgObj.hasOwnProperty("project") ) {
        type = "PROJECT";
    }

    else if( msgObj.hasOwnProperty("pipeline") ) {
        type = "PIPELINE";
    }

    else if( msgObj.hasOwnProperty("Records") && msgObj.Records[0].hasOwnProperty("codecommit") ) {
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
function setData(msgObj, data)
{
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
            data.channel = msgObj.state === "SUCCEEDED" ? "announcements" : msgObj.channel;
            data.text = "PIPELINE: " + msgObj.pipeline;
            break;

        case "CODECOMMIT":

            break;

        default:
            break;

    }

    data.text = util.format("*%s*", data.text);



        // for(var i in msgObj.detail['additional-information'].phases) {
        //     var phase = msgObj.detail['additional-information'].phases[i]
        //     if(phase['phase-status'] == "FAILED") {
        //         message += "\n" + phase['phase-type'] + " phase failed: " + phase['phase-context'].toString();
        //     }
        // }
}

function addAttachments(msgObj, data)
{
    data.attachments = [];

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
            var isProd = msgObj.approval.customData.isProd;

            data.attachments = [
                {
                    "color": getColour(isProd ? "ALERT" : "INFO"),
                    "pretext": isProd ? "Ready for Production" : "QA finished",
                    "fields": [
                        {
                            "title": isProd ? "This will update production!" : "No changes will be made.",
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
                            "value": msgObj.command,
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
                                "value": util.format("<%s|Click to View>", msgObj.link)
                            }
                        ]
                    }
                ]
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
            break;
    }
}

/**
 *
 * @param {string} state
 * @returns {string}
 */
function getColour(state)
{
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