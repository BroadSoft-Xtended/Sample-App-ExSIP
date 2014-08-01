chrome.app.runtime.onLaunched.addListener(function() {
	chrome.app.window.create('app.html', {
		id : 'badphone',
		frame : 'none',
		resizable : false,
		bounds : {
			width : 340,
			height : 320
		}
	});
});