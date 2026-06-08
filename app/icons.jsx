/* AD_Icons — inline SVG icon set */
window.AD_Icons = (function() {
  const ico = (path, opts) => function Icon(props) {
    const sz = props.size || 16;
    return React.createElement('svg', {
      width: sz, height: sz,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: opts && opts.w ? opts.w : '1.6',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: props.className || '',
      style: props.style,
      'aria-hidden': true,
    },
      React.createElement('path', { d: path }),
      ...(opts && opts.extra ? opts.extra.map((d, i) => React.createElement('path', { key: i, d })) : []),
      ...(opts && opts.circles ? opts.circles.map((c, i) => React.createElement('circle', { key: i, ...c })) : [])
    );
  };

  return {
    Users: function(props) {
      const sz = props.size || 16;
      return React.createElement('svg', {
        width: sz, height: sz, viewBox: '0 0 16 16', fill: 'none',
        stroke: 'currentColor', strokeWidth: '1.6', strokeLinecap: 'round', strokeLinejoin: 'round',
        className: props.className || '', style: props.style, 'aria-hidden': true,
      }, [
        React.createElement('path', { key: 1, d: 'M11 13.5v-1a3 3 0 0 0-3-3H5a3 3 0 0 0-3 3v1' }),
        React.createElement('circle', { key: 2, cx: '6.5', cy: '5', r: '2.5' }),
        React.createElement('path', { key: 3, d: 'M14 13.5v-1a3 3 0 0 0-1.95-2.83' }),
        React.createElement('path', { key: 4, d: 'M10 3.13A3 3 0 0 1 10 8' }),
      ]);
    },

    Calendar: function(props) {
      const sz = props.size || 16;
      return React.createElement('svg', {
        width: sz, height: sz, viewBox: '0 0 16 16', fill: 'none',
        stroke: 'currentColor', strokeWidth: '1.6', strokeLinecap: 'round', strokeLinejoin: 'round',
        className: props.className || '', style: props.style, 'aria-hidden': true,
      }, [
        React.createElement('rect', { key: 1, x: '1.5', y: '2.5', width: '13', height: '12', rx: '2' }),
        React.createElement('path', { key: 2, d: 'M1.5 6.5h13M5 1v3M11 1v3' }),
      ]);
    },

    FileText: function(props) {
      const sz = props.size || 16;
      return React.createElement('svg', {
        width: sz, height: sz, viewBox: '0 0 16 16', fill: 'none',
        stroke: 'currentColor', strokeWidth: '1.6', strokeLinecap: 'round', strokeLinejoin: 'round',
        className: props.className || '', style: props.style, 'aria-hidden': true,
      }, [
        React.createElement('path', { key: 1, d: 'M9.5 1.5H3.5a1.5 1.5 0 0 0-1.5 1.5v10a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5V5.5l-4-4z' }),
        React.createElement('path', { key: 2, d: 'M9.5 1.5v4h4M5.5 8.5h5M5.5 11h5' }),
      ]);
    },

    DollarSign: function(props) {
      const sz = props.size || 16;
      return React.createElement('svg', {
        width: sz, height: sz, viewBox: '0 0 16 16', fill: 'none',
        stroke: 'currentColor', strokeWidth: '1.6', strokeLinecap: 'round', strokeLinejoin: 'round',
        className: props.className || '', style: props.style, 'aria-hidden': true,
      }, [
        React.createElement('path', { key: 1, d: 'M8 1v14M11 4H6.5a2.5 2.5 0 0 0 0 5h3a2.5 2.5 0 0 1 0 5H5' }),
      ]);
    },

    Clipboard: function(props) {
      const sz = props.size || 16;
      return React.createElement('svg', {
        width: sz, height: sz, viewBox: '0 0 16 16', fill: 'none',
        stroke: 'currentColor', strokeWidth: '1.6', strokeLinecap: 'round', strokeLinejoin: 'round',
        className: props.className || '', style: props.style, 'aria-hidden': true,
      }, [
        React.createElement('rect', { key: 1, x: '2.5', y: '3', width: '11', height: '11.5', rx: '1.5' }),
        React.createElement('path', { key: 2, d: 'M5.5 3V2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1M5.5 7.5h5M5.5 10h3' }),
      ]);
    },

    ChevronLeft: ico('M10 12L6 8l4-4'),

    ChevronRight: ico('M6 12l4-4-4-4'),

    ChevronDown: ico('M4 6l4 4 4-4'),

    Settings: function(props) {
      const sz = props.size || 16;
      return React.createElement('svg', {
        width: sz, height: sz, viewBox: '0 0 16 16', fill: 'none',
        stroke: 'currentColor', strokeWidth: '1.6', strokeLinecap: 'round', strokeLinejoin: 'round',
        className: props.className || '', style: props.style, 'aria-hidden': true,
      }, [
        React.createElement('circle', { key: 1, cx: '8', cy: '8', r: '2' }),
        React.createElement('path', { key: 2, d: 'M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.42 1.42M11.53 11.53l1.42 1.42M3.05 12.95l1.42-1.42M11.53 4.47l1.42-1.42' }),
      ]);
    },

    AlertCircle: function(props) {
      const sz = props.size || 16;
      return React.createElement('svg', {
        width: sz, height: sz, viewBox: '0 0 16 16', fill: 'none',
        stroke: 'currentColor', strokeWidth: '1.6', strokeLinecap: 'round', strokeLinejoin: 'round',
        className: props.className || '', style: props.style, 'aria-hidden': true,
      }, [
        React.createElement('circle', { key: 1, cx: '8', cy: '8', r: '6.5' }),
        React.createElement('path', { key: 2, d: 'M8 5.5v3M8 10.5v.5' }),
      ]);
    },

    Check: ico('M2.5 8l4 4 7-7'),

    X: ico('M4 4l8 8M12 4l-8 8'),

    Activity: function(props) {
      const sz = props.size || 16;
      return React.createElement('svg', {
        width: sz, height: sz, viewBox: '0 0 16 16', fill: 'none',
        stroke: 'currentColor', strokeWidth: '1.6', strokeLinecap: 'round', strokeLinejoin: 'round',
        className: props.className || '', style: props.style, 'aria-hidden': true,
      }, [
        React.createElement('path', { key: 1, d: 'M1 8h2.5l2-5 3 9.5 2.5-6.5L12.5 8H15' }),
      ]);
    },
  };
})();
