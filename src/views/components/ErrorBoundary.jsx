import { Component } from "react";
import { logger } from "../../models/loggerService.js";

export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { logger.error(error.message, { stack: info?.componentStack }); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center">
          <h1 className="text-xl font-bold text-accent">Ocurrió un error</h1>
          <p className="text-gray-600 mt-2">Intenta recargar la página.</p>
          <button className="mt-4 px-4 py-2 bg-primary text-white rounded" onClick={() => window.location.reload()}>Recargar</button>
        </div>
      );
    }
    return this.props.children;
  }
}