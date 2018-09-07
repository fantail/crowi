import React from 'react'
import PropTypes from 'prop-types'

import PageAlert from './PageAlerts/PageAlert'

export default class PageAlerts extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      alertAppeared: false,
      message: '',
      data: {},
    }
  }

  componentDidMount() {
    const socket = this.props.crowi.getWebSocket()

    socket.on('page edited', data => {
      const user = data.user
      const crowi = this.props.crowi

      if (user.username != crowi.getUser().name && this.props.pageId == data.page._id) {
        this.setState({
          alertAppeared: true,
          message: 'edit',
          data: data,
        })
      }
    })
  }

  render() {
    //    const attachmentToDelete = this.state.attachmentToDelete;

    if (!this.state.alertAppeared) {
      return null
    }

    return <PageAlert {...this.state} />
  }
}

PageAlerts.propTypes = {
  pageId: PropTypes.string,
  crowi: PropTypes.object.isRequired,
}
