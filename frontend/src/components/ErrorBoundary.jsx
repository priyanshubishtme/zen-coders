import { Component } from 'react';
import { ServerCrash } from 'lucide-react';
import { Alert } from '@/components/ui/alert.jsx';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <Alert tone="error" icon={ServerCrash} title="This page failed to render" role="alert">
          Refresh and try again. If it keeps happening, the request id in the API error panel is
          the one to quote.
        </Alert>
      );
    }
    return this.props.children;
  }
}
