import { BookCopy, FileSpreadsheet, Presentation, FileText, Image, Zap, Shield, Folder } from 'lucide-react';

const HomePage = () => {
  return (
    <div style={{
      minHeight: 'calc(100vh - 60px)',
      padding: '48px 32px',
      backgroundColor: '#EAF4F4',
      fontFamily: 'Atkinson Hyperlegible, sans-serif'
    }}>
      {/* Hero Section */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto 48px',
        textAlign: 'center'
      }}>
        <h1 style={{
          fontSize: '56px',
          fontWeight: '700',
          color: '#1a1a1a',
          marginBottom: '16px',
          lineHeight: '1.1',
          letterSpacing: '-0.02em'
        }}>
          Quick File Converter
        </h1>
        <p style={{
          fontSize: '22px',
          color: '#4a5568',
          lineHeight: '1.6',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          Fast, secure, and private file conversions
          <br />
          <span style={{ fontSize: '18px', color: '#718096' }}>All processing happens locally on your device</span>
        </p>
      </div>

      {/* Tools Grid */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '24px',
        marginBottom: '48px'
      }}>
        {[
          { icon: BookCopy, title: 'PDF', desc: 'Merge, split, compress & convert PDFs', color: '#e53e3e' },
          { icon: FileSpreadsheet, title: 'Excel', desc: 'Process spreadsheets and data files', color: '#38a169' },
          { icon: Presentation, title: 'PowerPoint', desc: 'Create and convert presentations', color: '#dd6b20' },
          { icon: FileText, title: 'Word', desc: 'Handle document files efficiently', color: '#3182ce' },
          { icon: Image, title: 'Image', desc: 'Convert and optimize images', color: '#805ad5' }
        ].map((tool, idx) => {
          const IconComponent = tool.icon;
          return (
            <div key={idx} style={{
              backgroundColor: 'white',
              padding: '32px 24px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              transition: 'all 0.2s ease',
              cursor: 'default',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)';
              e.currentTarget.style.borderColor = tool.color;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '12px',
                backgroundColor: `${tool.color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px'
              }}>
                <IconComponent size={28} style={{ color: tool.color }} strokeWidth={2} />
              </div>
              <h3 style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '8px'
              }}>
                {tool.title}
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#718096',
                lineHeight: '1.5'
              }}>
                {tool.desc}
              </p>
            </div>
          );
        })}
      </div>

      {/* Features Section */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px'
      }}>
        {[
          { icon: Shield, title: 'Private & Secure', desc: 'Files never leave your device' },
          { icon: Zap, title: 'Lightning Fast', desc: 'Instant local processing' },
          { icon: Folder, title: 'No File Limits', desc: 'Process unlimited files offline' }
        ].map((feature, idx) => {
          const IconComponent = feature.icon;
          return (
            <div key={idx} style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '16px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: '#CCE3DE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <IconComponent size={20} style={{ color: '#2c5f57' }} strokeWidth={2} />
              </div>
              <div>
                <h4 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1a1a1a',
                  marginBottom: '4px'
                }}>
                  {feature.title}
                </h4>
                <p style={{
                  fontSize: '14px',
                  color: '#718096',
                  lineHeight: '1.4'
                }}>
                  {feature.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HomePage;
