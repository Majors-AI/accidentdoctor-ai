/* AD_App — app shell with sidebar navigation */
window.AD_App = (function() {
  const { useState } = React;
  const Icons = window.AD_Icons;

  const NAV = [
    { id: 'patients',   label: 'Patients',        icon: 'Users',      group: 'Clinic'   },
    { id: 'referrals',  label: 'Referrals',        icon: 'Clipboard',  group: null       },
    { id: 'schedule',   label: 'Schedule',         icon: 'Calendar',   group: null       },
    { id: 'billing',    label: 'Billing',          icon: 'DollarSign', group: 'Finance'  },
    { id: 'account',    label: 'Account',          icon: 'Settings',   group: 'Practice' },
  ];

  const MOCK_USER = { full_name: 'Dr. Aisha Obi', role: 'provider' };

  return function App() {
    const [screen,   setScreen]   = useState('patients');
    const [chartId,  setChartId]  = useState(null);

    function navigate(s) { setScreen(s); setChartId(null); }
    function openChart(id) { setChartId(id); setScreen('chart'); }

    let content = null;
    if (screen === 'chart' && chartId) {
      content = React.createElement(window.AD_ScreenChart, {
        chartId,
        onBack: function() { navigate('patients'); },
      });
    } else if (screen === 'patients') {
      content = React.createElement(window.AD_ScreenPatients, {
        onSelectChart: openChart,
      });
    } else {
      content = React.createElement('div', null,
        React.createElement('div', { className: 'page-h' },
          React.createElement('h1', null, screen.charAt(0).toUpperCase() + screen.slice(1)),
        ),
        React.createElement('div', { className: 'scaffold' }, 'This screen is a placeholder in the prototype.'),
      );
    }

    let lastGroup = null;
    const navItems = [];
    NAV.forEach(function(item) {
      if (item.group && item.group !== lastGroup) {
        lastGroup = item.group;
        navItems.push(React.createElement('div', { key: 'g-' + item.group, className: 'nav-group' }, item.group));
      }
      const Ico = Icons ? Icons[item.icon] : null;
      navItems.push(
        React.createElement('div', {
          key: item.id,
          className: 'nav-item' + ((screen === item.id || (screen === 'chart' && item.id === 'patients')) ? ' active' : ''),
          onClick: function() { navigate(item.id); },
        },
          Ico ? React.createElement(Ico, { className: 'ico' }) : null,
          item.label,
        )
      );
    });

    return React.createElement('div', { className: 'shell' },

      React.createElement('aside', { className: 'side' },
        React.createElement('div', { className: 'brand' },
          'Accident', React.createElement('br'),
          'Doctor', React.createElement('em', null, '.ai'),
          React.createElement('small', null, 'Provider Portal'),
        ),
        ...navItems,
        React.createElement('div', { className: 'side-who' },
          React.createElement('strong', null, MOCK_USER.full_name),
          React.createElement('div', { className: 'role' }, MOCK_USER.role.replace(/_/g, ' ')),
          React.createElement('button', {
            className: 'btn ghost sm',
            style: { color: '#e9e3d4', borderColor: 'rgba(255,255,255,.2)', marginTop: 10, width: '100%' },
          }, 'Sign out'),
        ),
      ),

      React.createElement('main', { className: 'main' }, content),
    );
  };
})();
