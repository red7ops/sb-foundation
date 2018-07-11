var https = require('https');
var util = require('util');

/**
 * SNS Event object.
 * @typedef {Object} SnsEvent
 * @property {Array.<SnsRecord>} Records
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
 * @property {string} [pipeline]
 * @property {string} [project]
 * @property {string} [channel]
 * @property {string} [state]
 * @property {string} [link]
 * @property {string} [command]
 * @property {Object} [approval]
 * @property {string} [approval.customData]
 * @property {string} [approval.pipelineName]
 * @property {string} [approval.approvalReviewLink]
 * @property {string} [AlarmName]
 * @property {string} [AlarmDescription]
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
 */
exports.handler = function(event, context) {
    console.log(JSON.stringify(event, null, 2));
    console.log('From SNS: ', event.Records[0].Sns.Message);

    var options = {
        method: 'POST',
        hostname: 'hooks.slack.com',
        port: 443,
        path: '/services/${SlackEndpoint}'
    };

    var req = https.request(options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            context.done(null);
        });
    });

    req.on('error', function(e) {
        console.log('problem with request: ' + e.message);
    });

    /**
     * postData
     * @type {DataObject}
     */
    var postData = {
        "username": "AWS SNS via Lambda :: Ops"
    };

    /**
     * SNS Data
     * @type {SnsObject}
     */
    var sns = event.Records[0].Sns;
    var type = setData(sns, postData);

    console.log('Type: ', type);

    postData.text = util.format("*%s: %s*", type, postData.text);




    // var message = event.Records[0].Sns.Message;
    // var subject = event.Records[0].Sns.Subject;


    // var postData = {
    //     "channel": "scoreboard-sns",
    //     "username": "AWS SNS via Lambda :: Ops",
    //     "text": subject,
    //     "attachments": [
    //         {
    //             "color": colour,
    //             "text": message
    //         }
    //     ]
    //
    // };











    req.write(util.format("%j", postData));
    req.end();

};

/**
 *
 * @param {SnsObject} sns
 * @param {DataObject} data
 * @returns {string} type
 */
function setData(sns, data)
{
    /**
     * Message
     * @type {MessageObject}
     */
    var msgObj = JSON.parse(message);

    if( msgObj.hasOwnProperty("AlarmName") ) {
        data.channel = "alarms";
        data.text = msgObj.AlarmName;
        data.attachments = [
            {
                "color": "warning",
                "text": msgObj.AlarmDescription
            }
        ];
        return "ALARM";
    }
    else if( msgObj.hasOwnProperty("approval") ) {
        /**
         * CustomData
         * @type {ApprovalData}
         */
        var customData = JSON.parse(msgObj.approval.customData);
        var link = msgObj.approval.approvalReviewLink;
        var text = customData.isProd ? "Ready for Production" : "QA finished";
        var colour = getColour(customData.isProd ? "ALERT" : "INFO");
        var title = customData.isProd ? "This will update production!" : "No changes will be made.";
        var value = util.format("<%s|Click to Approve>", link);

        data.channel = customData.channel;
        data.text = msgObj.approval.pipelineName;
        data.attachments = [
            {
                "color": colour,
                "pretext": text,
                "fields": [
                    {
                        "title": title,
                        "value": value
                    }
                ]
            }
        ];
        return "APPROVAL";
    }
    else if( msgObj.hasOwnProperty("project") ) {
        data.text = msgObj.project;

        data.channel = msgObj.channel;
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

        // for(var i in msgObj.detail['additional-information'].phases) {
        //     var phase = msgObj.detail['additional-information'].phases[i]
        //     if(phase['phase-status'] == "FAILED") {
        //         message += "\n" + phase['phase-type'] + " phase failed: " + phase['phase-context'].toString();
        //     }
        // }

        return "PROJECT";
    }
    else if( msgObj.hasOwnProperty("pipeline") ) {
        data.text = msgObj.pipeline;

        if(msgObj.state !== "SUCCEEDED")
        {
            data.channel = "announcements";
            data.attachments = [
                {
                    "color": getColour(msgObj.state),
                    "text": "Pipeline has completed successfully."
                }
            ];
        }
        else
        {
            data.channel = msgObj.channel;
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

        return "PIPELINE";
    }
    else
    {

    }



    return "UNKNOWN";
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
