/* global jQuery, window */
/*jslint sloppy: true, white:true, maxerr: 50, indent: 4, plusplus: true, vars:true */
/*******************************************************************
******polaroiderizer******
A fork of the original ( http://polaroiderizer.com/) by Phil Hawksworth (http://hawksworx.com/)

usage:
*** polaroiderizer( element, data, options )
***
***
*******************************************************************/

( function( $ ) {
var displayQueue = [],
	backlog = {}, // backlog of photos that we currently have in memory where keys are image url
	qPos = 0, timer = null, zIndex = 4,
	leftSide = true, // flag to make sure alternate between left and right side
	currentStack = [];

$.fn.addPolaroid = function( el, options ) {
	var $parent = this,
		$el = $( el ),
		rotateStr, style, num = parseInt( Math.random() * ( options.rotationRange ), 10 ),
		$frame, $photo,
		w, x, y,
		timeout;

	$parent.find( 'div.plain' ).remove();
	num = num - options.rotationRange / 2;
	rotateStr = 'rotate(' + num + 'deg)';
	style = {
		'-webkit-transform': rotateStr,
		'-moz-transform': rotateStr,
		'-o-transform': rotateStr,
		'-ms-transform': rotateStr,
		'transform': rotateStr
	};
	$frame = $( '<div class="polaroid"></div>' ).css( style ).append( el );
	$photo = $el.find( 'img' );
	if( currentStack.indexOf( $photo.attr( 'src' ) ) > -1 ) {
		return; // don't place duplicates
	}
	currentStack.push( $photo.attr( 'src' ) );

	$parent.append( $frame );

	// set starting point
	w = $parent.width();
	y = $frame.height();
	x = 40 + Math.floor( Math.random() * (  ( w / 2) - $frame.width() - 80 ) );
	if ( !leftSide ) {
		x += w / 2;
	}
	leftSide = !leftSide;

	$frame.css( {top: '-'+y+'px', left: x+'px'} );

	// set opacity of photo
	$photo.css( {opacity: '0'} );

	// animate photo opacity and into view
	function animateFrame() {
		$frame.css( 'z-index', '' ).animate( {
			top: $parent.height() + 'px', opacity: '0'
			}, options.dropDuration, function() {
				currentStack[ currentStack.indexOf( $photo.attr( 'src' ) ) ] = null; // hacky. don't care. does job.
				$frame.remove();
			} );
	}
	$frame.animate( { top: '15px' }, 400 );
	$photo.animate( { opacity: '1' }, options.fadeDuration,
		function( picture ) {
			// animate slowly out of view and opacity of entire object.
			animateFrame();
		} );
	function stop() {
		if( timeout ) {
			window.clearTimeout( timeout );
		}
		$photo.stop().css( 'z-index', zIndex ).css( 'opacity', 1 );
		$frame.stop().css( 'z-index', zIndex ).css( 'opacity', 1 );
		zIndex += 1;
	}

	$frame.hover( function() {
			stop();
		}, function() {
			timeout = window.setTimeout( function() {
				animateFrame();
			}, 500 );
		
		} ).mouseover( function() {
			stop();
		} );

	$photo.mouseover( function() {
		stop();
	} ).find( 'img' ).mouseover( function() {
		stop();
	} );
	return this;
};

// Iterate throught the images which are downloaded and ready to display.
function displayNext( $el, options ){
	var i = displayQueue[ qPos ], title, link;
	if( i ) {
		$el.addPolaroid( i, options );
		title = $( i ).find( 'img' ).attr( 'title' );
		link = $( i ).clone().empty().text( title );
		$el.find( '.status' ).html( link );
	} 
	qPos++;
	if ( qPos >= displayQueue.length ) {
		qPos = 0;
	}
	timer = window.setTimeout( function() {
		displayNext( $el, options );
		}, options.dropDelay );
}

// Get photos from the flickr or commons API and add them to the display queue.
function getPhotos( $el, origData, options ) {
	var uri, handler, source = options.source;
	if ( source === 'commons' ) {
		uri = 'http://commons.wikimedia.org/w/api.php?callback=?';
		handler = function( data, callback ) {
			var photos = [];
			$.each( data.query.pages, function( i, pic ) {
				if ( pic.imageinfo && pic.imageinfo[ 0 ] ) {
					var info = pic.imageinfo[ 0 ];
					photos.push( {
						src: pic.imageinfo[ 0 ].thumburl,
						link: pic.imageinfo[ 0 ].descriptionurl,
						title: pic.title,
						author: info.user ? 'by ' + info.user : ''
					} );
				}
			} );
			callback( photos );
		};
	} else {
		uri = 'http://api.flickr.com/services/rest/?method=flickr.photos.search' +
			'&api_key=0a346a54dbca829015b11fcac9e70c6f' +
			'&per_page=500' +
			'&format=json' +
		    '&jsoncallback=?';
		handler = function( data, callback ) {
			var photos = [];
			$.each( data.photos.photo, function( i, pic ) {
				photos.push( {
					src: 'http://farm'+ pic.farm +'.static.flickr.com/'+pic.server+'/'+pic.id+'_'+pic.secret+'.jpg',
					link: 'http://flickr.com/photos/'+pic.owner+'/'+ pic.id,
					title: pic.title
				} );
			} );
			callback( photos );
		};
	}
	$.getJSON( uri, origData || {}, function( data ) {
		handler( data, function( photos ) {
			var i, photo;
			function loadNewImage() {
				var a = $( '<a>' ).attr( 'href', $( this ).data( 'link' ) ).attr( 'target', '_BLANK' ).
					append( $( this ).clone() );
				$( '<span class="caption">' ).text( $( this ).data( 'author' ) ).appendTo( a );
				displayQueue.push( a );
			}
			$el.find( '.status' ).html( 'Found some photos. Making a slideshow...' );
			for( i = 0; i < photos.length; i++ ) {
				photo = photos[ i ];
				//clear it out and start again...
				if ( timer ) {
					window.clearTimeout( timer );
					timer = null;
				}
				if ( !backlog[ photo.src ] ) {
					backlog[ photo.src ] = true;
					$('<img>' ).attr( 'src', photo.src ).data( 'author', photo.author || '' ).data( 'link', photo.link ).attr( 'title', photo.title ).
						load( loadNewImage ).
						appendTo( $el.find( '.staging' ) );
				}
			}
		} );
		displayNext( $el, options );
	} );
}

function polaroiderizer( $el, data, options ) {
	$el.empty();
	displayQueue = [];
	qPos = 0;
	// AVAILABLE OPTIONS
	var defaultOptions = {
		dropDelay: 3000,
		fadeDuration: 1000,
		dropDuration: 10000,
		source: 'commons',
		rotationRange: 30,
		pollInterval: 1000 * 60 * 10 // every 10 minutes look for more
	};
	options = options || {};
	$.extend( defaultOptions, options );
	$( '<div>' ).addClass( 'status' ).appendTo( $el );
	$( '<div>' ).addClass( 'staging' ).hide().appendTo( $el );
	qPos = 0;
	getPhotos( $el, data, defaultOptions );
	window.setInterval( function() {
		getPhotos( $el, data, defaultOptions );
	}, defaultOptions.pollInterval );
	$el.find( '.status' ).html( 'Please wait while we load some photos' );
}
window.polaroiderizer = polaroiderizer;
}( jQuery ) );
