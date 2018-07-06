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
 * @property {String} Subject
 * @property {String} Channel
 * @property {String} State
 * @property {String} Message
 */

/**
 *
 * @param event SnsEvent
 * @param context Object
 */
exports.handler = function(event, context) {
    console.log(JSON.stringify(event, null, 2));
    console.log('From SNS:', event.Records[0].Sns.Message);

    // Defaults
    var message = event.Records[0].Sns.Message;
    var subject = event.Records[0].Sns.Subject;
    var channel = "scoreboard-sns";
    var colour = "good";
    var state = "UNKNOWN";

    /**
     * Message
     * @type {MessageObject}
     */
    var msgObj = JSON.parse(message);
    if( msgObj.hasOwnProperty("Subject") ) {
        subject = msgObj.Subject;
    }
    if( msgObj.hasOwnProperty("Channel") ) {
        channel = msgObj.Channel;
    }
    if( msgObj.hasOwnProperty("Message") ) {
        message = msgObj.Message;
    }
    if( msgObj.hasOwnProperty("State") ) {
        state = msgObj.State;
        switch(state) {
            case "FAILED":
                colour = "danger";
                break;

            case "CANCELED":
                colour = "warning";
                break;

            case "STARTED":
            case "RESUMED":
                colour = "#1a45f2";
                break;

            default:
                break;
        }
    }


    if( msgObj.hasOwnProperty("AlarmName") ) {
        channel = "alarms";
        colour = "warning";
        message = msgObj.AlarmDescription;
    }
    else if( msgObj.hasOwnProperty("source") && msgObj.source == "aws.codepipeline" ) {
        channel = "pipelines";
        subject = "PIPELINE: " + msgObj.detail.pipeline;
        message = "Pipeline state change: " + msgObj.detail.state;

        if( msgObj.hasOwnProperty("channel") ) {
            channel = msgObj.channel;
        }

        switch(msgObj.detail.state) {
            case "FAILED":
                colour = "danger";
                break;

            case "CANCELED":
                colour = "warning";
                break;

            case "STARTED":
                colour = "#1a45f2";
                break;

            case "SUCCEEDED":
                subject = "COMPLETED: " + channel;
                channel = "announcements";
                message = "A new version is available for " + msgObj.detail.pipeline;
                break;

            default:
                break;
        }
    }
    else if( msgObj.hasOwnProperty("source") && msgObj.source == "aws.codebuild" ) {
        if( msgObj.hasOwnProperty("channel") ) {
            channel = msgObj.channel;
        }
        subject = "BUILD: " + msgObj.detail['project-name'];
        message = "Project state change: " + msgObj.detail['build-status'];

        for(var i in msgObj.detail['additional-information'].phases) {
            var phase = msgObj.detail['additional-information'].phases[i]
            if(phase['phase-status'] == "FAILED") {
                message += "\n" + phase['phase-type'] + " phase failed: " + phase['phase-context'].toString();
            }
        }

        message += "\n\nLogs URL and CLI command:\n " + msgObj.detail['additional-information'].logs['deep-link'];
        message += "\naws --query events[*].message --output text logs filter-log-events";
        message += " --log-group-name " + msgObj.detail['additional-information'].logs['group-name'];
        message += " --log-stream-names " + msgObj.detail['additional-information'].logs['stream-name'];

        switch(msgObj.detail['build-status']) {
            case "FAILED":
                colour = "danger";
                break;

            case "STOPPED":
                colour = "warning";
                break;

            default:
                break;
        }

    }

    var postData = {
        "channel": channel,
        "username": "AWS SNS via Lambda :: Ops",
        "text": "*" + subject + "*"
    };

    postData.attachments = [
        {
            "color": colour,
            "text": message
        }
    ];

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

    req.write(util.format("%j", postData));
    req.end();
};