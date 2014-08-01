var ua = null;
var session = null;
var state = 'disconnected';
var isVideo = false;
var attempt = 0;
var timeoutId = null;
var sourceId = null;

chrome.app.window.current().onClosed.addListener(function() {
	try {
		session.terminate();
		us.stop();
	} catch (error) {
	}
});
document.addEventListener('DOMContentLoaded', contentLoaded);
document.addEventListener('keypress', onKeyPress);

function onKeyPress(e) {
	if (ua && session && (state == 'video' || state == 'audio')) {
		var charCode = e.charCode;
		if (charCode >= 48 && charCode <= 57) {
			charCode -= 48;
			session.sendDTMF(charCode, getDTMFOptions());
		} else if (charCode == 35) {
			session.sendDTMF('#', getDTMFOptions());
		} else if (charCode == 42) {
			session.sendDTMF('*', getDTMFOptions());
		}
	}
}

function onSignInClicked() {
	var wrsAddress = $('#wrsAddress').val();
	var uri = $('#uri').val();
	var authUser = $('#authUser').val();
	var password = $('#password').val();
	// TODO: validate input

	updateUI('connecting');

	var configuration = {
		'ws_servers' : [ {
			'ws_uri' : wrsAddress,
			'weight' : 0
		} ],
		'uri' : uri,
		'auth_user' : authUser,
		'password' : password,
		'trace_sip' : true
	};
	chrome.storage.local.set({
		'configuration' : configuration
	});

	ua = new ExSIP.UA(configuration);
	ua.setRtcMediaHandlerOptions({
		'reuseLocalMedia' : false,
		'disableICE' : true,
		'RTCConstraints' : {
			'optional' : [ {
				'DtlsSrtpKeyAgreement' : true
			} ],
			'mandatory' : {}
		}
	});

	ua.on('connected', function(e) {
		console.log(e);
		showMessage('Connected');
		updateUI('onhook');
		session = null;
		isVideo = false;
	});
	ua.on('disconnected', function(e) {
		console.log(e);
		onSignOutClicked();
		session = null;
		isVideo = false;
	});
	ua.on('newRTCSession', function(e) {
		console.log(e);
		session = e.data.session;
		session.on('progress', function(event) {
			console.log(event);
		});
		session.on('failed', function(event) {
			console.log(event);
			var message = event.data.message;
			if (message) {
				var statusCode = message.status_code;
				var reasonPhrase = message.reason_phrase;
				showMessage('Error: ' + statusCode + ' ' + reasonPhrase);
			} else {
				showMessage('An unknown error occurred.');
			}
			session = null;
			isVideo = false;
			updateUI('onhook');
		});
		session.on('started', function(event) {
			console.log(event);
			var s = event.sender;
			var localStreams = s.getLocalStreams();
			if (localStreams.length > 0) {
				var selfVideo = document.getElementById('selfVideo');
				selfVideo.src = window.URL.createObjectURL(localStreams[0]);
			}
			var remoteStreams = s.getRemoteStreams();
			if (remoteStreams.length > 0) {
				var remoteVideo = document.getElementById('remoteVideo');
				remoteVideo.src = window.URL.createObjectURL(remoteStreams[0]);
			}
			if (localStreams[0].getVideoTracks().length > 0) {
				isVideo = true;
				updateUI('video');
			} else {
				isVideo = false;
				updateUI('audio');
			}
		});
		session.on('resumed', function(event) {
			console.log(event);
		});
		session.on('held', function(event) {
			console.log(event);
		});
		session.on('ended', function(event) {
			console.log(event);
			session = null;
			isVideo = false;
			updateUI('onhook');
		});
		session.on('newDTMF', function(event) {
			console.log(event);
		});
		if (session.direction === 'incoming') {
			showMessage('Call from ' + session.from_tag);
			updateUI('alerting');
		}
	});
	ua.on('newMessage', function(e) {
		console.log(e);
	});
	ua.on('registered', function(e) {
		console.log(e);
		showMessage('Registered');
	});
	ua.on('unregistered', function(e) {
		console.log(e);
		register();
	});
	ua.on('registrationFailed', function(e) {
		console.log(e);
		register();
	});
	ua.on('onReInvite', function(e) {
		console.log(e);
		e.data.session.acceptReInvite();
	});
	ua.start();
}

function register() {
	if (ua) {
		if (attempt > 3) {
			attempt = 0;
		}
		var wait = (Math.pow(2, attempt) * 5000)
				+ Math.floor(Math.random() * 11) * 1000;
		showMessage('Unregistered, will try again in ' + (wait / 1000) + 's.');
		attempt++;
		timeoutId = setTimeout(function() {
			if (ua) {
				ua.register();
			}
		}, wait);
	}
}

function onSignOutClicked() {
	clearTimeout(timeoutId);
	timeoutId = null;
	try {
		session.terminate();
	} catch (error) {
	}
	session = null;
	try {
		ua.stop();
	} catch (error) {
	}
	ua = null;
	updateUI('disconnected');
}

function contentLoaded() {
	chrome.runtime.onMessageExternal.addListener(function(request, sender,
			sendResponse) {
		if (request.type == 'CALL') {
			if (ua) {
				try {
					ua.call(request.number, getExSIPOptions(true));
				} catch (error) {
					updateUI('onhook');
				}
			}
		}
	});
	chrome.storage.local.get([ 'configuration' ], function(data) {
		if (data.configuration) {
			console.log(data.configuration);
			$('#wrsAddress').val(data.configuration.ws_servers[0].ws_uri);
			$('#uri').val(data.configuration.uri);
			$('#authUser').val(data.configuration.auth_user);
			$('#password').val(data.configuration.password);
		}
	});
	$('#btnSignIn').click(onSignInClicked);
	$('#btnAudio').click(onAudioClicked);
	$('#btnVideo').click(onVideoClicked);
	$('#btnAnswer').click(onAnswerClicked);
	$('#btnDecline').click(onDeclineClicked);
	$('#btnSignOut').click(onSignOutClicked);
	$('#btnExit').click(onExitClicked);
	updateUI('disconnected');
}

function onExitClicked() {
	window.close();
}

function onAnswerClicked() {
	if (ua && session) {
		try {
			session.answer(getExSIPOptions(true));
			updateUI('video');
		} catch (error) {
			updateUI('onhook');
		}
	}
}

function onDeclineClicked() {
	if (ua && session) {
		try {
			session.terminate();
		} catch (error) {
			updateUI('onhook');
		}
	}
}

function onAudioClicked() {
	if (ua.isConnected()) {
		if (session) {
			try {
				session.terminate();
			} catch (error) {
				updateUI('onhook');
			}
		} else {
			var number = $('#tbNumber').val();
			try {
				ua.call(number, getExSIPOptions(false));
			} catch (error) {
				updateUI('onhook');
			}
		}
	}
}

function onVideoClicked() {
	if (ua.isConnected()) {
		if (session) {
			ua.getUserMedia(getExSIPOptions(!isVideo), function(localStream) {
				var options = {
					'localMedia' : localStream,
					'createOfferConstraints' : {
						'mandatory' : {
							'OfferToReceiveAudio' : true,
							'OfferToReceiveVideo' : !isVideo
						}
					}
				};
				var selfVideo = document.getElementById('selfVideo');
				selfVideo.src = window.URL.createObjectURL(localStream);
				session.changeSession(options, function() {
					console.log('change session succeeded');
				}, function() {
					console.log('change session failed');
				});
			}, function() {
				console.log('getUserMedia() succeeded');
			}, function() {
				console.log('getUserMedia() failed');
			}, true);
		} else {
			var number = $('#tbNumber').val();
			try {
				ua.call(number, getExSIPOptions(true));
			} catch (error) {
				updateUI('onhook');
			}
		}
	}
}

function end() {
	if (ua && session) {
		try {
			session.terminate();
		} catch (error) {
			updateUI('onhook');
		}
	}
}

function updateUI(newState) {
	state = newState;
	switch (state) {
	case 'connecting':
		$('#signIn').hide();
		$('#connecting').show();
		showMessage('Connecting to WRS, please wait...');
		$('#toolbar').hide();
		$('#views').hide();
		break;
	case 'disconnected':
		$('#signIn').show();
		$('#connecting').hide();
		$('#toolbar').hide();
		$('#views').hide();
		break;
	case 'onhook':
		$('#signIn').hide();
		$('#connecting').hide();
		$('#toolbar').show();
		$('#tbNumber').show();
		$('#btnAudio').show();
		$('#btnAudio').attr('class', 'inactive');
		$('#btnVideo').show();
		$('#btnVideo').attr('class', 'inactive');
		$('#btnAnswer').hide();
		$('#btnDecline').hide();
		$('#views').hide();
		break;
	case 'audio':
		$('#signIn').hide();
		$('#connecting').hide();
		$('#toolbar').show();
		$('#tbNumber').show();
		$('#btnAudio').show();
		$('#btnAudio').attr('class', 'hangup');
		$('#btnVideo').show();
		$('#btnVideo').attr('class', 'inactive');
		$('#btnAnswer').hide();
		$('#btnDecline').hide();
		$('#views').hide();
		break;
	case 'video':
		$('#signIn').hide();
		$('#connecting').hide();
		$('#toolbar').show();
		$('#tbNumber').show();
		$('#btnAudio').show();
		$('#btnAudio').attr('class', 'hangup');
		$('#btnVideo').show();
		$('#btnVideo').attr('class', 'active');
		$('#btnAnswer').hide();
		$('#btnDecline').hide();
		$('#views').show();
		break;
	case 'alerting':
		$('#btnAudio').hide();
		$('#btnVideo').hide();
		$('#btnAnswer').show();
		$('#btnDecline').show();
		break;
	}
}

function getExSIPOptions(videoEnabled) {
	var options = {
		'mediaConstraints' : {
			'audio' : true,
			'video' : videoEnabled
		},
		'createOfferConstraints' : {
			'mandatory' : {
				'OfferToReceiveAudio' : true,
				'OfferToReceiveVideo' : videoEnabled
			}
		}
	};
	return options;
}

function getDTMFOptions() {
	var options = {
		'duration' : 160,
		'interToneGap' : 1200
	};
	return options;
}

function showMessage(message) {
	$('#message').html(message);
	$('#message').show();
	$('#message').fadeOut(5000);
}