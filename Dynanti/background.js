var defaults = {
	'forename': 'Joey',
	'surname': 'Chan',
	'dobmin': 1970,
	'dobmax': 1992,
	'password': 'Welcome123',
	'apikey': 'a02fa2c95c2940ee95ec4563baee6c2d'
};


var maxTries = 4;
var waitTime = 5000;

chrome.storage.local.get('values', function(data) {
	if (!data.values) {
		chrome.storage.local.set({values: defaults});
	}
});

chrome.browserAction.onClicked.addListener(function(tab) {
	chrome.tabs.executeScript(tab.id, { file: "jquery-2.1.1.min.js" }, function() {
		chrome.tabs.executeScript(tab.id, { file: "createusers.js" });
	});
});

chrome.runtime.onMessage.addListener(
	function(request, sender, sendResponse) {
		if(request.log) {
			console.log(request.log);
		} else if (request.dir) {
			console.dir(request.dir);
		} else if (request.verify) {
			setTimeout(function() {
				verifyEmail(request.verify, 1, sender);
			}, waitTime);
		}
	}
);


function verifyEmail(email, tries, sender) {
	console.log('Requesting inbox: ' + email.email);

	chrome.storage.local.get('values', function(data) {
		var token = data.values.apikey;

		$.get('https://api.mailinator.com/api/inbox?token='+token+'&to='+email.email,
		//$.get('mocks/inbox.json',
		function(dataStr) {

			var data = JSON.parse(dataStr);
			console.log('inbox size: ' + data.messages.length);

			if (data.messages.length == 1) {

				console.log('requesting message: ' + data.messages[0].id);
				$.get('https://api.mailinator.com/api/email?token='+token+'&msgid=' + data.messages[0].id, function(messageStr) {
					//$.get('mocks/message.json', function(messageStr) {
					var message = JSON.parse(messageStr);

					var link = /https:\/\/.*IR1_VerifyFromEmail.*"/.exec(message.data.parts[0].body)[0].replace('"', '');

					console.log('got link: ' + link);

					$.get(link, function() {
						console.log('returning with success');

						storeEmail(email);

						chrome.notifications.create('success' + email.email, {
							type: 'basic',
							title: 'Success',
							message: 'Activated account ' + email.email + '@mailinator.com',
							isClickable: true,
							iconUrl: 'icon48.png',
							buttons: [
							{ title: 'Login' }
							]
						}, function(){});
						chrome.notifications.onButtonClicked.addListener(function(nid, bid) {
							chrome.tabs.create({url: getDomainFromWholeUrl(email.url) + 'IL1_Login.aspx'}, function(tab) {
								chrome.tabs.executeScript(tab.id, { file: "jquery-2.1.1.min.js" }, function() {
									chrome.tabs.executeScript(tab.id, { file: "login.js" }, function() {
										chrome.storage.local.get('values', function(values){
											chrome.tabs.sendMessage(tab.id, {email: email.wholeEmail, password: values.values.password});
										});
									});
								});
							});
						});
					}).fail(function(err){
						console.dir(err);
						chrome.notifications.create('error', {
							type: 'basic',
							title: 'Error',
							message: 'Failed to activate account: ' + error.message,
							iconUrl: 'icon48.png'
						}, function(){});
					});
				});
			} else {
				if (tries < maxTries) {
					setTimeout(function() {
						verifyEmail(email, tries + 1, sender);
					}, waitTime);
				} else {
					chrome.notifications.create('error-no-activation-email', {
						type: 'basic',
						title: 'Error',
						message: 'Failed to retreive activation email after ' + ((maxTries * waitTime) / 1000) + ' seconds',
						buttons: [
						{ title: 'Activate manually' }
						],
						iconUrl: 'icon48.png'
					}, function(){});
					chrome.notifications.onButtonClicked.addListener(function(nid, bid) {
						if (nid == 'error-no-activation-email') {
							chrome.tabs.create({url: 'http://mailinator.com/inbox.jsp?to=' + email.email});
						}
					});
				}
			}
		}
	).fail(function(err) {
		console.dir(err);
		chrome.notifications.create('error-no-inboxes', {
			type: 'basic',
			title: 'Error',
			message: 'Failed to retreive inbox from mailinator api. Most likely your api key is locked out, create an account on mailinator and then change set your key in the settings',
			iconUrl: 'icon48.png'
		}, function(){});
	});
});
}

function storeEmail(email) {
	// lets log it in the list of completed emails
	chrome.storage.local.get(['values', 'emails'], function(data) {
		var emails = data.emails || [];
		var domain = getDomainFromWholeUrl(email.url);
		emails.push({
			email: email.wholeEmail,
			domain: domain,
			password: data.values.password
		});
		chrome.storage.local.set({'emails': emails});
	});
}

function getDomainFromWholeUrl(url) {
	var re = /(http[s]?:\/\/[a-zA-Z0-9.\/_]+)PublicPages\/IR1_Register.aspx/;
	var m = re.exec(url)
	return m[1];
}
