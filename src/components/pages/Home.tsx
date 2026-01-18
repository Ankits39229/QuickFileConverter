const HomePage = () => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 'calc(100vh - 60px)',
      padding: '40px',
      backgroundColor: '#EAF4F4',
      fontFamily: 'Atkinson Hyperlegible, sans-serif'
    }}>
      <div style={{
        maxWidth: '800px',
        textAlign: 'center',
        backgroundColor: 'white',
        padding: '60px 40px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{
          fontSize: '48px',
          fontWeight: '700',
          color: '#1a1a1a',
          marginBottom: '16px',
          lineHeight: '1.2'
        }}>
          Welcome to Quick File Converter
        </h1>
        <p style={{
          fontSize: '20px',
          color: '#666',
          lineHeight: '1.6',
          marginBottom: '32px'
        }}>
          Your all-in-one document conversion toolkit
        </p>
        <div style={{
          padding: '32px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          marginTop: '32px'
        }}>
          <p style={{
            fontSize: '16px',
            color: '#555',
            lineHeight: '1.8',
            marginBottom: '16px'
          }}>
            Use the sidebar to navigate to different tools:
          </p>
          <ul style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            fontSize: '15px',
            color: '#666',
            lineHeight: '2'
          }}>
            <li>📄 PDF Tools - Convert and manipulate PDFs</li>
            <li>📊 Excel Tools - Work with spreadsheets</li>
            <li>📑 PowerPoint Tools - Create and convert presentations</li>
            <li>📝 Word Tools - Handle document files</li>
            <li>🖼️ Image Tools - Process images</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
