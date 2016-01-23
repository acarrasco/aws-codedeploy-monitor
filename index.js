var parseArgs = require('minimist');
var AWS = require('aws-sdk');

var opts = parseArgs(process.argv.slice(2));
var exit = process.exit;

if (opts.help) {
	console.log('Usage:');
	console.log('\t' + process.argv[0] + ' ' + process.argv[1] + '...');
	console.log('\topts:');
	console.log('\t--help (shows this message)');
	console.log('\t--region region (aws region, default=us-east-1)');
	console.log('\t--interval n (poll interval in seconds, default=5)');
	console.log('\t--timeout n (max wait in seconds, default=600)');
	console.log('\t--deploymentId id (aws code-deploy deployment id, read from stdin as the json output of create-deployment)');
	exit(0);
}

var CodeDeploy = new AWS.CodeDeploy({region: opts.region || 'us-east-1'});

function watch(deploymentId) {
	console.log(deploymentId);
	var maxWait = Number(opts.timeout || 600) * 1000;
	var interval = Number(opts.interval || 5) * 1000;
	var startTime = Date.now();
	function watchLoop() {
		var elapsed = Date.now() - startTime;
		if (elapsed > maxWait) {
			console.log('Timeout exceeded');
			exit(-1);
		}

		CodeDeploy.getDeployment({
			deploymentId: deploymentId
		}, function(err, data) {
			if (err) {
				console.log(err);
				exit(-1);
			}

			console.log(data.deploymentInfo.deploymentOverview);
			console.log(data.deploymentInfo.status);
			switch (data.deploymentInfo.status) {
				case 'Succeeded':
					exit(0);
				case 'Failed' :
				case 'Stopped':
					exit(-1);
				case 'Created':
				case 'Queued':
				case 'InProgress':
					setTimeout(watchLoop, interval);
			}
		});
	}

	watchLoop();
}

function getDeploymentId(opts, callback) {
	if (opts.deploymentId) {
		callback(opts.deploymentId);
	} else {
		var stdin = process.stdin;
		var inputChunks = [];

		stdin.resume();
		stdin.setEncoding('utf8');

		stdin.on('data', function(chunk) {
			inputChunks.push(chunk);
		});

		stdin.on('end', function() {
			var inputJSON = inputChunks.join();
			var parsedData = JSON.parse(inputJSON);
			callback(parsedData.deploymentId);
		});
	}
}

getDeploymentId(opts, watch);
